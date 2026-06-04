#!/usr/bin/env node
// Monorepo-aware wiki bench. Auto-detects per-app + per-lib scopes inside
// each repo (NestJS monorepo + libs/, or kustomize app directories), and
// builds one wiki PER SCOPE rather than one wiki per repo.
//
// Each scope = one microservice (or one library, or one kustomize app).
// Wiki page slugs are scoped — no collisions when AppModule exists in 5 apps.
//
// Iteration flow per scope (only scopes with file diff are processed):
//   1. tree-sitter snapshot scoped to scope.root subdir
//   2. essence extractor (1 LLM call per affected scope)
//   3. parallel subagent calls per affected page within that scope
//
// Cost should drop dramatically vs whole-monorepo wiki because most commits
// touch only 1-2 scopes.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { detectScopes } from '../src/scope/monorepo.js';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { generatePage, patchPageFromEssence } from '../src/llm/page-generator.js';
import { extractEssence, indexFeaturesBySlug } from '../src/wiki/essence.js';
import { computeRelated } from '../src/wiki/related.js';
import { assemblePage } from '../src/wiki/page-assembly.js';
import { buildIndex } from '../src/wiki/index-builder.js';
import { stableJson } from '../src/snapshot/store.js';
import { judge } from '../src/llm/judge.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 5);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 25);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 5);
const JUDGE_SAMPLE = Number(argv.find((a) => a.startsWith('--judge-sample='))?.split('=')[1] ?? 3);

const REPOS = [
  { name: 'backend1', path: process.env.NAMI_REPO_BACKEND1, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
  { name: 'kustomize', path: process.env.NAMI_REPO_KUSTOMIZE, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
];
for (const r of REPOS) if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }

const OUT_ROOT = join(process.cwd(), '.lab', 'wiki-monorepo');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const accrue = (res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded (now $${totalCost.toFixed(2)})`);
};

// Clone + resolve SHAs
const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `wmb-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () => simpleGit(r.path).clone(r.path, tmp));
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    sourceShas[date] = raw.trim();
  }
  // Detect scopes at the LATEST SHA so structure stable across iters
  await simpleGit(tmp).checkout(sourceShas[r.dates[r.dates.length - 1]]);
  const scopes = detectScopes(tmp);
  console.log(`[${r.name}] scopes: ${scopes.length}`);
  for (const s of scopes) console.log(`           ${s.kind} ${s.name}  (${s.root})`);

  repoState[r.name] = {
    tmp, git: simpleGit(tmp), sourceShas, dates: r.dates, scopes,
    // per-scope state
    state: Object.fromEntries(scopes.map((s) => [s.root, {
      scope: s, snap: null, smap: null, pageBodies: new Map(), pages: new Map(),
    }])),
  };
}

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });
  const iterRecord = { iter, repos: {}, cost: { baseline: 0, essence: 0, subagents: 0, judge: 0 } };

  for (const r of REPOS) {
    const repoData = repoState[r.name];
    const sha = repoData.sourceShas[repoData.dates[iter]];
    console.log(`[${r.name}] checkout ${sha.slice(0,7)}`);
    await repoData.git.checkout(sha);
    iterRecord.repos[r.name] = { sha, scopes: {} };

    // Process scopes in parallel
    await pMap(repoData.scopes, async (scope) => {
      const state = repoData.state[scope.root];
      const scopePath = join(repoData.tmp, scope.root);
      const scopeOutDir = join(iterDir, r.name, scope.root.replace(/\//g, '__'));
      mkdirSync(scopeOutDir, { recursive: true });

      let scopeBaselineCost = 0;
      let scopeEssenceCost = 0;
      let scopeSubagentCost = 0;
      let touched = 0;
      let mode = 'no-op';

      if (iter === 0) {
        // Baseline full scan PER scope
        state.snap = buildSnapshotForScope(scopePath);
        state.smap = synthSourcemap(state.snap);
        const pages = Object.entries(state.smap.pages).filter(([slug, p]) => slug !== 'index.md' && p.symbols.length > 0);
        if (pages.length === 0) {
          mode = 'empty-scope';
        } else {
          mode = 'baseline-full';
          const jobs = pages.map(([slug, page]) => ({ slug, page, symbols: state.snap.symbols.filter((s) => page.symbols.includes(s.id)) }));
          const results = await pMap(jobs, async (j) => {
            const res = await generatePage({ slug: j.slug, symbols: j.symbols, repoRoot: scopePath, claudeOpts });
            return { ...j, res };
          }, { concurrency: CONCURRENCY });
          for (const { slug, page, res } of results) {
            state.pageBodies.set(slug, res.content);
            const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
            state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
            accrue(res); scopeBaselineCost += res.costUsd ?? 0; touched++;
          }
          state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
        }
      } else {
        // Incremental — only proceed if file diff non-zero within scope
        const before = state.snap;
        const after = buildSnapshotForScope(scopePath);
        const diff = diffSnapshots(before, after);
        const inv = invalidate({ diff, sourcemap: state.smap, currentSymbols: after.symbols });
        state.smap = applyInvalidation({ sourcemap: state.smap, invalidation: inv, newSnapshot: after });
        state.snap = after;
        for (const slug of inv.pagesDeleted) { state.pages.delete(slug); state.pageBodies.delete(slug); }

        const totalChanges = diff.symbols.added.length + diff.symbols.sigChanged.length + diff.symbols.bodyChanged.length + diff.symbols.deleted.length;
        if (totalChanges === 0) {
          mode = 'no-op';
        } else {
          mode = 'essence';
          const essRes = await extractEssence({
            diff, sourcemap: state.smap, repoName: r.name, scopeName: scope.name, scopeKind: scope.kind, claudeOpts,
          });
          accrue(essRes); scopeEssenceCost = essRes.costUsd ?? 0;
          writeFileSync(join(scopeOutDir, 'essence.json'), stableJson({ features: essRes.features }));

          const featuresBySlug = indexFeaturesBySlug(essRes.features);
          const affectedSlugs = Object.keys(featuresBySlug);
          const jobs = affectedSlugs.map((slug) => {
            const page = state.smap.pages[slug];
            if (!page || page.symbols.length === 0) return null;
            const symbols = after.symbols.filter((s) => page.symbols.includes(s.id));
            if (!symbols.length) return null;
            return { slug, page, symbols, features: featuresBySlug[slug] ?? [] };
          }).filter(Boolean);
          const results = await pMap(jobs, async (j) => {
            const existing = state.pageBodies.get(j.slug) ?? '';
            const res = await patchPageFromEssence({
              slug: j.slug, existingPage: existing, features: j.features, symbols: j.symbols, claudeOpts,
            });
            return { ...j, existing, res };
          }, { concurrency: CONCURRENCY });
          for (const { slug, page, res } of results) {
            state.pageBodies.set(slug, res.content);
            const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
            state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
            accrue(res); scopeSubagentCost += res.costUsd ?? 0; touched++;
          }
          if (touched) {
            state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
          }
        }
      }

      // Save final state
      const pagesDir = join(scopeOutDir, 'pages');
      mkdirSync(pagesDir, { recursive: true });
      for (const [slug, content] of state.pages) writeFileSync(join(pagesDir, safeFile(slug)), content);

      iterRecord.repos[r.name].scopes[scope.root] = {
        kind: scope.kind, name: scope.name, mode, touched,
        cost: { baseline: scopeBaselineCost, essence: scopeEssenceCost, subagents: scopeSubagentCost },
        pagesCount: state.pages.size,
      };
      iterRecord.cost.baseline += scopeBaselineCost;
      iterRecord.cost.essence += scopeEssenceCost;
      iterRecord.cost.subagents += scopeSubagentCost;
    }, { concurrency: 3 });

    // Monorepo-level summary line per repo
    const scopeSummary = Object.values(iterRecord.repos[r.name].scopes)
      .filter((s) => s.touched > 0 || s.mode === 'baseline-full')
      .map((s) => `${s.name}(${s.mode}/${s.touched})`).join(' ');
    console.log(`        ${r.name}: ${scopeSummary || '(no scope changes)'}`);
  }

  // Judge sample — pick 3 random touched scopes total across the iter
  const touchedScopes = [];
  for (const [repoName, repoInfo] of Object.entries(iterRecord.repos)) {
    for (const [scopeRoot, info] of Object.entries(repoInfo.scopes)) {
      if (info.touched > 0) touchedScopes.push({ repoName, scopeRoot, info });
    }
  }
  // Judge: per-scope sample of pages we have body for, judged against same-iter
  // full re-generation cost is too high — we approximate by comparing to the
  // iter-0 baseline (still on git history). For now skip judge step (was the
  // most expensive item). Add later if useful.
  iterRecord.cumulativeTotalCost = totalCost;
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  console.log(`[iter ${iter}] baseline=$${iterRecord.cost.baseline.toFixed(2)} essence=$${iterRecord.cost.essence.toFixed(2)} subagents=$${iterRecord.cost.subagents.toFixed(2)}  cumul=$${totalCost.toFixed(2)}`);
}

const summary = {
  model: MODEL, iters: N_ITERS, cumulativeCost: totalCost,
  perIter: iterReports.map((r) => ({ iter: r.iter, cost: r.cost, cumulativeTotalCost: r.cumulativeTotalCost })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

console.log('\n=== WIKI MONOREPO BENCH SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total: $${totalCost.toFixed(2)}`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });

function safeFile(slug) { return slug.replace(/[/]/g, '_'); }

function buildSnapshotForScope(scopePath) {
  // walk only within scope.root
  return buildSnapshot(scopePath);
}
