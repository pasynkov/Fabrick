#!/usr/bin/env node
// Wiki-only drift bench across multiple iterations.
//
// Iteration N:
//   1. checkout each repo at iteration's commit date
//   2. wiki-incremental: patches + new pages from previous state
//   3. wiki-fullrebuild: from-scratch generation at same sha (ground truth)
//   4. judge: sample K shared slugs, compare incr vs full
//
// All artifacts persisted for inspection:
//   .lab/wiki-drift/iter-N/
//     <repo>/
//       wiki-incremental/
//         before/                wiki state BEFORE iteration's patches
//         patches/<slug>/        action.txt, existing-body.md, change-reasons.txt, prompt.txt, llm-response.md
//         after/                 wiki state AFTER patches
//         narrative.md           commit narrative (iter > 0)
//       wiki-fullrebuild/
//         pages/                 ground-truth pages
//         calls/<slug>/          per-page generate prompt + response
//       judge/
//         sample.json            per-page judge verdicts
//     report.json                per-iter aggregate
//   summary.json                 cross-iter trend
//   README.md

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { generatePage, patchPage } from '../src/llm/page-generator.js';
import { generateCommitNarrative } from '../src/llm/narrative.js';
import { computeRelated } from '../src/wiki/related.js';
import { assemblePage } from '../src/wiki/page-assembly.js';
import { buildIndex } from '../src/wiki/index-builder.js';
import { stableJson } from '../src/snapshot/store.js';
import { judge } from '../src/llm/judge.js';
import { structuralEquivalence } from '../src/validate/validate.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 3);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 30);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 5);
const JUDGE_SAMPLE = Number(argv.find((a) => a.startsWith('--judge-sample='))?.split('=')[1] ?? 5);

const REPOS = [
  { name: 'backend1', path: process.env.NAMI_REPO_BACKEND1, subdir: '.', dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
  { name: 'kustomize', path: process.env.NAMI_REPO_KUSTOMIZE, subdir: '.', dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
];
for (const r of REPOS) {
  if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }
}

const OUT_ROOT = join(process.cwd(), '.lab', 'wiki-drift');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const accrue = (res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded (now $${totalCost.toFixed(2)})`);
};

// per-repo state
const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `wd-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () =>
    simpleGit(r.path).clone(r.path, tmp),
  );
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    const sha = raw.trim();
    if (!sha) throw new Error(`${r.name}: no commit before ${date}`);
    sourceShas[date] = sha;
  }
  console.log(`[${r.name}] iteration SHAs:`, Object.entries(sourceShas).map(([d, s]) => `${d}=${s.slice(0,7)}`).join('  '));
  repoState[r.name] = {
    tmp,
    git: simpleGit(tmp),
    sourceShas,
    subdir: r.subdir,
    dates: r.dates,
    snap: null,
    smap: null,
    pageBodies: new Map(),
    pages: new Map(),
  };
}

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} (${iter === 0 ? 'baseline' : `+${iter}`}) ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });
  const iterRecord = { iter, repos: {}, cost: { incremental: 0, fullRebuild: 0, narrative: 0, judge: 0 } };

  await pMap(REPOS, async (r) => {
    const state = repoState[r.name];
    const date = state.dates[iter];
    const sha = state.sourceShas[date];
    console.log(`[${r.name}] checkout ${sha.slice(0,7)} (${date})`);
    await state.git.checkout(sha);
    const subPath = join(state.tmp, state.subdir);

    const repoDir = join(iterDir, r.name);
    const incrDir = join(repoDir, 'wiki-incremental');
    const fullDir = join(repoDir, 'wiki-fullrebuild');
    const judgeDir = join(repoDir, 'judge');
    const beforeDir = join(incrDir, 'before');
    const patchesDir = join(incrDir, 'patches');
    const afterDir = join(incrDir, 'after');
    const fullPagesDir = join(fullDir, 'pages');
    const fullCallsDir = join(fullDir, 'calls');
    mkdirSync(beforeDir, { recursive: true });
    mkdirSync(patchesDir, { recursive: true });
    mkdirSync(afterDir, { recursive: true });
    mkdirSync(fullPagesDir, { recursive: true });
    mkdirSync(fullCallsDir, { recursive: true });
    mkdirSync(judgeDir, { recursive: true });

    // Snapshot BEFORE
    for (const [slug, content] of state.pages) writeFileSync(join(beforeDir, safeFile(slug)), content);

    let incrCost = 0;
    let narrativeCost = 0;
    let incrPagesTouched = 0;

    if (iter === 0) {
      // baseline full scan
      state.snap = buildSnapshot(subPath);
      state.smap = synthSourcemap(state.snap);
      console.log(`[${r.name}] baseline files=${Object.keys(state.snap.files).length} symbols=${state.snap.symbols.length} pages=${Object.keys(state.smap.pages).length - 1}`);
      const jobs = Object.entries(state.smap.pages)
        .filter(([slug, p]) => slug !== 'index.md' && p.symbols.length > 0)
        .map(([slug, page]) => ({ slug, page, symbols: state.snap.symbols.filter((s) => page.symbols.includes(s.id)) }));
      const t0 = Date.now();
      const results = await pMap(jobs, async (j) => {
        const res = await generatePage({ slug: j.slug, symbols: j.symbols, repoRoot: subPath, claudeOpts });
        return { ...j, res };
      }, { concurrency: CONCURRENCY });
      console.log(`[${r.name}] baseline ${jobs.length} pages in ${((Date.now()-t0)/1000).toFixed(1)}s`);
      for (const { slug, page, res } of results) {
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'baseline-generate\n');
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
        accrue(res); incrCost += res.costUsd ?? 0; incrPagesTouched++;
      }
      state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
    } else {
      // incremental
      const before = state.snap;
      const after = buildSnapshot(subPath);
      const diff = diffSnapshots(before, after);
      const inv = invalidate({ diff, sourcemap: state.smap, currentSymbols: after.symbols });
      state.smap = applyInvalidation({ sourcemap: state.smap, invalidation: inv, newSnapshot: after });
      state.snap = after;
      for (const slug of inv.pagesDeleted) { state.pages.delete(slug); state.pageBodies.delete(slug); }

      let narrative = '';
      if (inv.pagesInvalidated.length + inv.newSymbols.length > 0) {
        const narrRes = await generateCommitNarrative({ diff, claudeOpts });
        narrative = narrRes.narrative;
        accrue(narrRes); narrativeCost += narrRes.costUsd ?? 0;
        writeFileSync(join(incrDir, 'narrative.md'), narrative + '\n');
      }

      const patchJobs = inv.pagesInvalidated
        .filter((slug) => slug !== 'index.md')
        .map((slug) => ({ slug, page: state.smap.pages[slug] }))
        .filter((j) => j.page && j.page.symbols.length > 0)
        .map((j) => ({ ...j, symbols: after.symbols.filter((s) => j.page.symbols.includes(s.id)) }))
        .filter((j) => j.symbols.length > 0);
      const patchResults = await pMap(patchJobs, async (j) => {
        const existingBody = state.pageBodies.get(j.slug) ?? '';
        const res = await patchPage({
          slug: j.slug, existingPage: existingBody, changes: inv.reasons[j.slug] ?? [],
          symbols: j.symbols, repoRoot: subPath, claudeOpts,
          beforeSnapshotSymbols: before.symbols, afterSnapshotSymbols: after.symbols,
        });
        return { ...j, existingBody, res };
      }, { concurrency: CONCURRENCY });
      for (const { slug, page, existingBody, res } of patchResults) {
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'patch\n');
        writeFileSync(join(slugDir, 'existing-body.md'), existingBody);
        writeFileSync(join(slugDir, 'change-reasons.txt'), (inv.reasons[slug] ?? []).join('\n') + '\n');
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
        accrue(res); incrCost += res.costUsd ?? 0; incrPagesTouched++;
      }

      const newJobs = inv.newSymbols
        .map((sym) => ({ sym, slug: slugFor(sym) }))
        .filter((j) => !state.pages.has(j.slug))
        .map((j) => ({ ...j, symbols: after.symbols.filter((s) => s.file === j.sym.file && (s.name === j.sym.name || s.name.startsWith(j.sym.name + '.'))) }))
        .filter((j) => j.symbols.length > 0);
      const newResults = await pMap(newJobs, async (j) => {
        const res = await generatePage({ slug: j.slug, symbols: j.symbols, repoRoot: subPath, claudeOpts });
        return { ...j, res };
      }, { concurrency: CONCURRENCY });
      for (const { sym, slug, symbols, res } of newResults) {
        state.pageBodies.set(slug, res.content);
        const page = { symbols: symbols.map((s) => s.id), files: [sym.file] };
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'new-page\n');
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
        accrue(res); incrCost += res.costUsd ?? 0; incrPagesTouched++;
      }

      // refresh related + index for touched repo
      if (incrPagesTouched > 0) {
        for (const [s, b] of state.pageBodies) {
          const page = state.smap.pages[s];
          if (!page) continue;
          const rel = computeRelated({ slug: s, sourcemap: state.smap, snapshot: state.snap });
          state.pages.set(s, assemblePage({ slug: s, body: b, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: rel, updated: sha.slice(0,7) }));
        }
        state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
      }
    }

    // Snapshot AFTER
    for (const [slug, content] of state.pages) writeFileSync(join(afterDir, safeFile(slug)), content);

    // FULL REBUILD (ground truth). At iter 0, the incremental baseline IS the full
    // rebuild — re-use to save cost. From iter 1+ they diverge, so we generate fresh.
    const freshSnap = buildSnapshot(subPath);
    const freshSmap = synthSourcemap(freshSnap);
    const fullPages = new Map();
    const fullBodies = new Map();
    let fullCost = 0;

    if (iter === 0) {
      // re-use the just-generated incremental baseline
      for (const [slug, body] of state.pageBodies) fullBodies.set(slug, body);
      for (const [slug, content] of state.pages) {
        fullPages.set(slug, content);
        writeFileSync(join(fullPagesDir, safeFile(slug)), content);
      }
      writeFileSync(join(fullDir, 'NOTE.md'), 'At iter-0 the incremental baseline IS the full rebuild; no separate LLM calls were made.\n');
    } else {
      const fullJobs = Object.entries(freshSmap.pages)
        .filter(([slug, p]) => slug !== 'index.md' && p.symbols.length > 0)
        .map(([slug, page]) => ({ slug, page, symbols: freshSnap.symbols.filter((s) => page.symbols.includes(s.id)) }));
      const t0Full = Date.now();
      const fullResults = await pMap(fullJobs, async (j) => {
        const res = await generatePage({ slug: j.slug, symbols: j.symbols, repoRoot: subPath, claudeOpts });
        return { ...j, res };
      }, { concurrency: CONCURRENCY });
      console.log(`[${r.name}] full-rebuild ${fullJobs.length} pages in ${((Date.now()-t0Full)/1000).toFixed(1)}s`);
      for (const { slug, page, res } of fullResults) {
        fullBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: freshSmap, snapshot: freshSnap });
        const assembled = assemblePage({ slug, body: res.content, page, sourcemap: freshSmap, snapshot: freshSnap, relatedSlugs: related, updated: sha.slice(0,7) });
        fullPages.set(slug, assembled);
        writeFileSync(join(fullPagesDir, safeFile(slug)), assembled);
        const slugDir = join(fullCallsDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
        accrue(res); fullCost += res.costUsd ?? 0;
      }
      fullPages.set('index.md', buildIndex({ sourcemap: freshSmap, snapshot: freshSnap, pages: fullPages, updated: sha.slice(0,7) }));
      writeFileSync(join(fullPagesDir, 'index.md'), fullPages.get('index.md') ?? '');
    }

    // structural drift between incr smap and fresh smap
    const equiv = structuralEquivalence(state.smap, freshSmap);

    // judge: sample K shared non-index slugs
    const shared = [...state.pageBodies.keys()].filter((s) => fullBodies.has(s));
    // prefer touched-this-iter slugs for fair stress test
    const touchedThisIter = iter > 0
      ? [...state.pageBodies.keys()].filter((s) => incrPagesTouched > 0).slice(0, Math.floor(JUDGE_SAMPLE / 2))
      : [];
    const sampleSlugs = [...new Set([...touchedThisIter, ...shared])].slice(0, JUDGE_SAMPLE);
    const verdicts = await pMap(sampleSlugs, async (slug) => {
      const v = await judge({
        pageA: state.pages.get(slug),
        pageB: fullPages.get(slug),
        context: `Both pages document slug "${slug}" in repo "${r.name}".`,
        claudeOpts,
      });
      return { slug, score: v.score, equivalent: v.equivalent, differences: v.differences ?? [], _raw: v };
    }, { concurrency: CONCURRENCY });
    let judgeCost = 0;
    for (const v of verdicts) { accrue(v._raw); judgeCost += v._raw?.costUsd ?? 0; delete v._raw; }
    writeFileSync(join(judgeDir, 'sample.json'), stableJson({ slugs: sampleSlugs, verdicts }));

    const avgScore = verdicts.length ? verdicts.reduce((s, v) => s + (v.score ?? 0), 0) / verdicts.length : null;
    iterRecord.repos[r.name] = {
      sha,
      mode: iter === 0 ? 'full' : 'incremental',
      incrPagesTouched,
      pagesIncrTotal: state.pages.size,
      pagesFullTotal: fullPages.size,
      structuralDrift: equiv.drift,
      structuralBreakdown: {
        onlyInIncr: equiv.onlyInA.length,
        onlyInFull: equiv.onlyInB.length,
        symbolsDiffer: equiv.symbolsDiffer.length,
        filesDiffer: equiv.filesDiffer.length,
      },
      avgJudgeScore: avgScore,
      verdicts,
      cost: { incremental: incrCost, narrative: narrativeCost, fullRebuild: fullCost, judge: judgeCost },
    };
    iterRecord.cost.incremental += incrCost;
    iterRecord.cost.narrative += narrativeCost;
    iterRecord.cost.fullRebuild += fullCost;
    iterRecord.cost.judge += judgeCost;
  }, { concurrency: 2 });

  iterRecord.cumulativeTotalCost = totalCost;
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  console.log(`[iter ${iter}] cost: incr=$${iterRecord.cost.incremental.toFixed(2)} narrative=$${iterRecord.cost.narrative.toFixed(2)} full=$${iterRecord.cost.fullRebuild.toFixed(2)} judge=$${iterRecord.cost.judge.toFixed(2)}  cumul=$${totalCost.toFixed(2)}`);
  for (const [repo, info] of Object.entries(iterRecord.repos)) {
    const scores = info.verdicts.map((v) => `${v.slug.replace(/\.md$/, '')}=${v.score}`).join(' ');
    console.log(`        ${repo}: pagesIncr=${info.pagesIncrTotal} touched=${info.incrPagesTouched} structDrift=${(info.structuralDrift*100).toFixed(1)}% avgJudge=${info.avgJudgeScore?.toFixed(2) ?? 'n/a'}`);
    console.log(`                ${scores}`);
  }
}

// summary
const summary = {
  model: MODEL,
  iters: N_ITERS,
  cumulativeCost: totalCost,
  perIter: iterReports.map((r) => ({
    iter: r.iter,
    cost: r.cost,
    cumulativeTotalCost: r.cumulativeTotalCost,
    repos: Object.fromEntries(Object.entries(r.repos).map(([k, v]) => [k, {
      structuralDrift: v.structuralDrift,
      avgJudgeScore: v.avgJudgeScore,
      incrPagesTouched: v.incrPagesTouched,
      pagesTotal: v.pagesIncrTotal,
    }])),
  })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

writeFileSync(join(OUT_ROOT, 'README.md'), `# Wiki-only drift bench

Layout per iteration:

\`\`\`
iter-N/
  <repo>/
    wiki-incremental/
      before/                 wiki state BEFORE this iteration's patches
      patches/<slug>/         action + existing + reasons + prompt + response
      after/                  wiki state AFTER patches (final incr state)
      narrative.md            commit narrative (iter > 0)
    wiki-fullrebuild/
      pages/                  ground-truth pages
      calls/<slug>/           per-page generate prompt + response
    judge/sample.json         per-page LLM verdicts (score, equivalent, differences)
  report.json                 per-iter aggregate
\`\`\`

\`summary.json\` aggregates cost + drift trend per iter.
`);

console.log('\n=== WIKI-DRIFT SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total spent: $${totalCost.toFixed(2)}`);
console.log(`reports: ${OUT_ROOT}/iter-{0..${N_ITERS}}/report.json`);
console.log(`summary: ${OUT_ROOT}/summary.json`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });

function safeFile(slug) { return slug.replace(/[/]/g, '_'); }

function slugFor(sym) {
  const kindDir = { class: 'entities', interface: 'entities', type: 'types', function: 'logic', enum: 'enums', const: 'consts', Deployment: 'entities', Service: 'entities', ConfigMap: 'entities', Kustomization: 'entities' }[sym.kind] ?? 'misc';
  const safe = sym.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${kindDir}/${safe}.md`;
}
