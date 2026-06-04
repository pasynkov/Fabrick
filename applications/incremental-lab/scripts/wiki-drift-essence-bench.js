#!/usr/bin/env node
// Wiki essence pipeline bench. CACHE-DRIVEN: reads wiki-drift cached outputs
// to skip baseline LLM generation and ground-truth full rebuild.
//
// Per iter (N > 0):
//   1. snapshot diff between SHAs (tree-sitter, fast, ~30s per repo) — fresh
//   2. essence extractor: 1 LLM call per repo → features[]
//   3. coordinator (JS, deterministic): route features by affectedPages
//   4. parallel subagent calls: per affected page, apply only relevant
//      features (small prompt — no raw source code)
//   5. judge sample using cached full-rebuild bodies as ground truth
//
// Compares cost of essence-driven patching vs per-page-with-full-source baseline.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { patchPageFromEssence } from '../src/llm/page-generator.js';
import { extractEssence, indexFeaturesBySlug } from '../src/wiki/essence.js';
import { computeRelated } from '../src/wiki/related.js';
import { assemblePage } from '../src/wiki/page-assembly.js';
import { buildIndex } from '../src/wiki/index-builder.js';
import { stableJson } from '../src/snapshot/store.js';
import { judge } from '../src/llm/judge.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const WIKI_ROOT = argv.find((a) => a.startsWith('--wiki-root='))?.split('=')[1] ?? '.lab/wiki-drift';
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 5);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 15);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 5);
const JUDGE_SAMPLE = Number(argv.find((a) => a.startsWith('--judge-sample='))?.split('=')[1] ?? 5);

const REPOS = [
  { name: 'backend1', path: process.env.NAMI_REPO_BACKEND1, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
  { name: 'kustomize', path: process.env.NAMI_REPO_KUSTOMIZE, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
];

if (!existsSync(WIKI_ROOT)) { console.error(`Wiki cache missing: ${WIKI_ROOT}`); process.exit(1); }
for (const r of REPOS) if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }

const OUT_ROOT = join(process.cwd(), '.lab', 'wiki-drift-essence');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const accrue = (res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded (now $${totalCost.toFixed(2)})`);
};

// Clone repos + resolve SHAs
const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `wde-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () => simpleGit(r.path).clone(r.path, tmp));
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    sourceShas[date] = raw.trim();
  }
  repoState[r.name] = {
    tmp, git: simpleGit(tmp), sourceShas, dates: r.dates,
    snap: null, smap: null, pageBodies: new Map(), pages: new Map(),
  };
}

// Helpers to load cached wiki state
function loadWikiDir(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const slug = name.replace(/_/g, '/');
    out[slug] = readFileSync(join(dir, name), 'utf8');
  }
  return out;
}
function extractBodyOnly(assembled) {
  // strip frontmatter + Related section to get the LLM "body"
  let s = assembled.replace(/^---[\s\S]*?---\n+/, '');
  s = s.replace(/\n*##\s+Related[\s\S]*?(?=\n##\s+|\n*$)/g, '\n').trimEnd();
  return s + '\n';
}

async function snapshotAt(repoName, iter) {
  const state = repoState[repoName];
  const sha = state.sourceShas[state.dates[iter]];
  await state.git.checkout(sha);
  return buildSnapshot(state.tmp);
}

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });
  const iterRecord = { iter, repos: {}, cost: { essence: 0, incremental: 0, judge: 0 } };

  await pMap(REPOS, async (r) => {
    const state = repoState[r.name];
    const sha = state.sourceShas[state.dates[iter]];
    console.log(`[${r.name}] iter ${iter} sha=${sha.slice(0,7)}`);

    const repoDir = join(iterDir, r.name);
    const incrDir = join(repoDir, 'wiki-essence');
    const judgeDir = join(repoDir, 'judge');
    const beforeDir = join(incrDir, 'before');
    const patchesDir = join(incrDir, 'patches');
    const afterDir = join(incrDir, 'after');
    for (const d of [beforeDir, patchesDir, afterDir, judgeDir]) mkdirSync(d, { recursive: true });

    for (const [slug, content] of state.pages) writeFileSync(join(beforeDir, safeFile(slug)), content);

    let incrCost = 0;
    let essenceCost = 0;
    let touched = 0;

    if (iter === 0) {
      // BOOTSTRAP from cache — load wiki bodies + rebuild snapshot/sourcemap from current SHA
      state.snap = await snapshotAt(r.name, iter);
      state.smap = synthSourcemap(state.snap);
      const cachedDir = join(WIKI_ROOT, `iter-0`, r.name, 'wiki-incremental', 'after');
      const cached = loadWikiDir(cachedDir);
      for (const [slug, assembled] of Object.entries(cached)) {
        state.pages.set(slug, assembled);
        if (slug !== 'index.md') state.pageBodies.set(slug, extractBodyOnly(assembled));
      }
      console.log(`[${r.name}] iter 0 loaded from cache: ${state.pages.size} pages (no LLM cost)`);
    } else {
      // Phase 1: snapshot diff (tree-sitter, no LLM)
      const before = state.snap;
      const after = await snapshotAt(r.name, iter);
      const diff = diffSnapshots(before, after);
      const inv = invalidate({ diff, sourcemap: state.smap, currentSymbols: after.symbols });
      state.smap = applyInvalidation({ sourcemap: state.smap, invalidation: inv, newSnapshot: after });
      state.snap = after;
      for (const slug of inv.pagesDeleted) { state.pages.delete(slug); state.pageBodies.delete(slug); }

      const totalChanges = diff.symbols.added.length + diff.symbols.sigChanged.length + diff.symbols.bodyChanged.length + diff.symbols.deleted.length;
      if (totalChanges === 0) {
        console.log(`[${r.name}] iter ${iter} no symbol changes`);
      } else {
        // Phase 2: essence extraction (1 LLM call)
        const essRes = await extractEssence({ diff, sourcemap: state.smap, repoName: r.name, claudeOpts });
        accrue(essRes); essenceCost += essRes.costUsd ?? 0;
        writeFileSync(join(incrDir, 'essence.json'), stableJson({ features: essRes.features }));
        writeFileSync(join(incrDir, 'essence.prompt.txt'), essRes.prompt);
        writeFileSync(join(incrDir, 'essence.response.md'), essRes.rawResponse);
        console.log(`[${r.name}] essence: ${essRes.features.length} features, $${(essRes.costUsd ?? 0).toFixed(3)}`);

        // Phase 3: route + fan-out to subagents
        //
        // Trust essence: only patch pages that essence explicitly tagged.
        // Invalidator's mechanical triggers (e.g. method body changes still in
        // pagesInvalidated cascade) are not enough — without a feature the
        // subagent has nothing to apply.
        const featuresBySlug = indexFeaturesBySlug(essRes.features);
        const affectedSlugs = Object.keys(featuresBySlug);
        const skippedNoFeature = inv.pagesInvalidated
          .filter((s) => s !== 'index.md' && !featuresBySlug[s]);

        const jobs = affectedSlugs
          .map((slug) => {
            const page = state.smap.pages[slug];
            if (!page || page.symbols.length === 0) return null;
            const symbols = after.symbols.filter((s) => page.symbols.includes(s.id));
            if (!symbols.length) return null;
            return { slug, page, symbols, features: featuresBySlug[slug] ?? [] };
          })
          .filter(Boolean);

        if (skippedNoFeature.length) {
          console.log(`[${r.name}] skipped ${skippedNoFeature.length} pages (invalidator-only, no essence features) — saved ${skippedNoFeature.length} subagent calls`);
        }
        const results = await pMap(jobs, async (j) => {
          const existing = state.pageBodies.get(j.slug) ?? '';
          const res = await patchPageFromEssence({
            slug: j.slug, existingPage: existing, features: j.features, symbols: j.symbols, claudeOpts,
          });
          return { ...j, existing, res };
        }, { concurrency: CONCURRENCY });
        for (const { slug, page, existing, features, res } of results) {
          state.pageBodies.set(slug, res.content);
          const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
          state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
          const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
          mkdirSync(slugDir, { recursive: true });
          writeFileSync(join(slugDir, 'action.txt'), 'essence-patch\n');
          writeFileSync(join(slugDir, 'existing-body.md'), existing);
          writeFileSync(join(slugDir, 'features.json'), stableJson(features));
          writeFileSync(join(slugDir, 'prompt.txt'), res.prompt);
          writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse);
          accrue(res); incrCost += res.costUsd ?? 0; touched++;
        }
        // Refresh related + index
        for (const [s, b] of state.pageBodies) {
          const page = state.smap.pages[s];
          if (!page) continue;
          const rel = computeRelated({ slug: s, sourcemap: state.smap, snapshot: state.snap });
          state.pages.set(s, assemblePage({ slug: s, body: b, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: rel, updated: sha.slice(0,7) }));
        }
        state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
      }
    }

    for (const [slug, content] of state.pages) writeFileSync(join(afterDir, safeFile(slug)), content);

    // Judge against cached full-rebuild bodies (no fresh full rebuild cost)
    const cachedFullDir = join(WIKI_ROOT, `iter-${iter}`, r.name, 'wiki-fullrebuild', 'pages');
    const cachedFull = loadWikiDir(cachedFullDir);
    const shared = [...state.pageBodies.keys()].filter((s) => s in cachedFull);
    const sample = shared.slice(0, JUDGE_SAMPLE);
    const verdicts = await pMap(sample, async (slug) => {
      const v = await judge({
        pageA: state.pages.get(slug),
        pageB: cachedFull[slug],
        context: `Both pages document slug "${slug}" in repo "${r.name}".`,
        claudeOpts,
      });
      return { slug, score: v.score, equivalent: v.equivalent, differences: v.differences ?? [], _raw: v };
    }, { concurrency: CONCURRENCY });
    let judgeCost = 0;
    for (const v of verdicts) { accrue(v._raw); judgeCost += v._raw?.costUsd ?? 0; delete v._raw; }
    writeFileSync(join(judgeDir, 'sample.json'), stableJson({ slugs: sample, verdicts }));

    const avgScore = verdicts.length ? verdicts.reduce((s, v) => s + (v.score ?? 0), 0) / verdicts.length : null;
    iterRecord.repos[r.name] = {
      sha, touched, avgJudgeScore: avgScore, verdicts,
      cost: { essence: essenceCost, incremental: incrCost, judge: judgeCost },
    };
    iterRecord.cost.essence += essenceCost;
    iterRecord.cost.incremental += incrCost;
    iterRecord.cost.judge += judgeCost;
  }, { concurrency: 2 });

  iterRecord.cumulativeTotalCost = totalCost;
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  console.log(`[iter ${iter}] essence=$${iterRecord.cost.essence.toFixed(2)} subagents=$${iterRecord.cost.incremental.toFixed(2)} judge=$${iterRecord.cost.judge.toFixed(2)}  cumul=$${totalCost.toFixed(2)}`);
  for (const [repo, info] of Object.entries(iterRecord.repos)) {
    const scores = info.verdicts.map((v) => `${v.slug.replace(/\.md$/, '')}=${v.score}`).join(' ');
    console.log(`        ${repo}: touched=${info.touched} avgJudge=${info.avgJudgeScore?.toFixed(2) ?? 'n/a'}`);
    console.log(`                ${scores}`);
  }
}

const summary = {
  model: MODEL, iters: N_ITERS, cumulativeCost: totalCost,
  perIter: iterReports.map((r) => ({
    iter: r.iter, cost: r.cost, cumulativeTotalCost: r.cumulativeTotalCost,
    repos: Object.fromEntries(Object.entries(r.repos).map(([k, v]) => [k, { touched: v.touched, avgJudgeScore: v.avgJudgeScore }])),
  })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

console.log('\n=== WIKI-DRIFT-ESSENCE SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total: $${totalCost.toFixed(2)}`);
console.log(`summary: ${OUT_ROOT}/summary.json`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });

function safeFile(slug) { return slug.replace(/[/]/g, '_'); }
