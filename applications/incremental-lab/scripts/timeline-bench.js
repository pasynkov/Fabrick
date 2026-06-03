#!/usr/bin/env node
// Multi-day timeline test across two repos with synthesis layer.
//
// Iteration N:
//   1. checkout each repo at iteration's commit
//   2. wiki layer: incremental update or full scan
//   3. synthesis layer: incremental update or full
//   4. judge incremental vs full at both levels
//   5. save .lab/timeline/iter-N/{repos/, arch/, full/, reports/}
//
// Cost reported per iteration and accumulated.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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
import { buildSynthesisSnapshot } from '../src/synthesis/snapshot.js';
import { diffSynthesisSnapshots, diffHasChanges } from '../src/synthesis/diff.js';
import { invalidateArchPages } from '../src/synthesis/invalidate.js';
import { buildArchSourcemap, DEFAULT_ARCH_TAXONOMY } from '../src/synthesis/sourcemap.js';
import { generateArchPage, patchArchPage, generateSynthesisNarrative } from '../src/synthesis/page-generator.js';
import { judge } from '../src/llm/judge.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 3);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 20);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';

const REPOS = [
  { name: 'backend1', role: 'code',  path: process.env.NAMI_REPO_BACKEND1,  subdir: '.', dates: ['2025-09-22', '2025-09-28', '2025-10-08', '2025-10-13'] },
  { name: 'kustomize', role: 'infra', path: process.env.NAMI_REPO_KUSTOMIZE ?? '/Users/pasynkov/dev/Nami/kustomize', subdir: '.', dates: ['2025-09-22', '2025-09-28', '2025-10-08', '2025-10-13'] },
];

for (const r of REPOS) {
  if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }
}

const OUT_ROOT = join(process.cwd(), '.lab', 'timeline');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const log = (label, res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded`);
};

// per-repo state across iterations
const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `tl-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () =>
    simpleGit(r.path).clone(r.path, tmp),
  );
  repoState[r.name] = {
    tmp,
    git: simpleGit(tmp),
    snap: null,
    smap: null,
    pageBodies: new Map(),
    pages: new Map(),
    role: r.role,
    subdir: r.subdir,
    dates: r.dates,
  };
}

// arch state across iterations
let archSourcemap = null;
const archPages = new Map();        // archSlug → assembled markdown
const archBodies = new Map();       // archSlug → LLM body for patching
let prevSynthSnap = null;

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} (${iter === 0 ? 'baseline' : `+${iter}`}) ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });

  const iterRecord = { iter, date: null, repos: {}, synthesis: null, cost: { wiki: 0, narrative: 0, synthesis: 0 } };

  // Step 1: advance each repo, wiki update
  for (const r of REPOS) {
    const state = repoState[r.name];
    const date = state.dates[iter];
    iterRecord.date = date;
    const sha = await pickShaByDate(state.git, date);
    console.log(`[${r.name}] checkout ${sha.slice(0,7)} (${date})`);
    await state.git.checkout(sha);
    const subPath = join(state.tmp, state.subdir);

    if (iter === 0) {
      // baseline full scan
      state.snap = buildSnapshot(subPath);
      state.smap = synthSourcemap(state.snap);
      console.log(`[${r.name}] baseline files=${Object.keys(state.snap.files).length} symbols=${state.snap.symbols.length} pages=${Object.keys(state.smap.pages).length - 1}`);
      let repoCost = 0;
      for (const [slug, page] of Object.entries(state.smap.pages)) {
        if (slug === 'index.md' || page.symbols.length === 0) continue;
        const symbols = state.snap.symbols.filter((s) => page.symbols.includes(s.id));
        const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts });
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        log('baseline', res); repoCost += res.costUsd ?? 0;
      }
      state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
      iterRecord.repos[r.name] = { sha, mode: 'full', pagesCount: state.pages.size, cost: repoCost };
      iterRecord.cost.wiki += repoCost;
    } else {
      // incremental
      const before = state.snap;
      const after = buildSnapshot(subPath);
      const diff = diffSnapshots(before, after);
      const inv = invalidate({ diff, sourcemap: state.smap, currentSymbols: after.symbols });
      state.smap = applyInvalidation({ sourcemap: state.smap, invalidation: inv, newSnapshot: after });
      state.snap = after;
      for (const slug of inv.pagesDeleted) { state.pages.delete(slug); state.pageBodies.delete(slug); }
      let repoCost = 0;
      let narrativeCost = 0;
      let narrative = '';
      if (inv.pagesInvalidated.length + inv.newSymbols.length > 0) {
        const narrRes = await generateCommitNarrative({ diff, claudeOpts });
        narrative = narrRes.narrative;
        log('narrative', narrRes); narrativeCost += narrRes.costUsd ?? 0;
      }
      const patchedSlugs = [];
      for (const slug of inv.pagesInvalidated) {
        if (slug === 'index.md') continue;
        const page = state.smap.pages[slug];
        if (!page || page.symbols.length === 0) continue;
        const symbols = after.symbols.filter((s) => page.symbols.includes(s.id));
        if (!symbols.length) continue;
        const existingBody = state.pageBodies.get(slug) ?? '';
        const res = await patchPage({
          slug, existingPage: existingBody, changes: inv.reasons[slug] ?? [],
          symbols, repoRoot: subPath, claudeOpts,
          beforeSnapshotSymbols: before.symbols, afterSnapshotSymbols: after.symbols,
        });
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        patchedSlugs.push(slug);
        log('patch', res); repoCost += res.costUsd ?? 0;
      }
      for (const sym of inv.newSymbols) {
        const slug = slugFor(sym);
        if (state.pages.has(slug)) continue;
        const symbols = after.symbols.filter((s) => s.file === sym.file && (s.name === sym.name || s.name.startsWith(sym.name + '.')));
        if (!symbols.length) continue;
        const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts });
        state.pageBodies.set(slug, res.content);
        const page = { symbols: symbols.map((s) => s.id), files: [sym.file] };
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        log('new', res); repoCost += res.costUsd ?? 0;
      }
      // refresh related + index for touched repo
      if (patchedSlugs.length || inv.newSymbols.length) {
        for (const [s, b] of state.pageBodies) {
          const page = state.smap.pages[s];
          if (!page) continue;
          const rel = computeRelated({ slug: s, sourcemap: state.smap, snapshot: state.snap });
          state.pages.set(s, assemblePage({ slug: s, body: b, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: rel, updated: sha.slice(0,7) }));
        }
        state.pages.set('index.md', buildIndex({ sourcemap: state.smap, snapshot: state.snap, pages: state.pages, updated: sha.slice(0,7) }));
      }
      iterRecord.repos[r.name] = { sha, mode: 'incremental', pagesCount: state.pages.size, patchedCount: patchedSlugs.length, newCount: inv.newSymbols.length, cost: repoCost, narrativeCost };
      iterRecord.cost.wiki += repoCost;
      iterRecord.cost.narrative += narrativeCost;
    }

    // save per-repo wiki
    const repoDir = join(iterDir, 'repos', r.name);
    mkdirSync(repoDir, { recursive: true });
    for (const [slug, content] of state.pages) {
      writeFileSync(join(repoDir, slug.replace(/[/]/g, '_')), content);
    }
  }

  // Step 2: synthesis layer
  const perRepoWikiPages = {};
  for (const r of REPOS) {
    perRepoWikiPages[r.name] = {};
    for (const [slug, body] of repoState[r.name].pageBodies) perRepoWikiPages[r.name][slug] = body;
  }
  const synthSnap = buildSynthesisSnapshot(perRepoWikiPages);

  const repoRoles = Object.fromEntries(REPOS.map((r) => [r.name, r.role]));
  const perRepoSlugs = Object.fromEntries(REPOS.map((r) => [r.name, [...repoState[r.name].pageBodies.keys()]]));
  archSourcemap = buildArchSourcemap({ perRepoSlugs, repoRoles });

  let synthesisCost = 0;
  if (iter === 0) {
    // full synthesis from scratch
    for (const archSlug of Object.keys(DEFAULT_ARCH_TAXONOMY)) {
      const wikiExcerpts = wikiExcerptsFor(archSlug, archSourcemap, repoState);
      const res = await generateArchPage({ archSlug, wikiExcerpts, claudeOpts });
      archBodies.set(archSlug, res.content);
      archPages.set(archSlug, res.content);  // arch page is body itself for now
      log('arch-gen', res); synthesisCost += res.costUsd ?? 0;
    }
    iterRecord.synthesis = { mode: 'full', invalidated: Object.keys(DEFAULT_ARCH_TAXONOMY), cost: synthesisCost };
  } else {
    // incremental synthesis
    const synthDiff = diffSynthesisSnapshots(prevSynthSnap, synthSnap);
    const { archInvalidated, reasons } = invalidateArchPages({ diff: synthDiff, archSourcemap });
    let synthNarrative = '';
    let synthNarrCost = 0;
    if (archInvalidated.length > 0 && diffHasChanges(synthDiff)) {
      const recentUpdates = [];
      for (const [repo, changes] of Object.entries(synthDiff)) {
        for (const slug of changes.changed.concat(changes.added).slice(0, 3)) {
          recentUpdates.push({ repo, slug, body: repoState[repo].pageBodies.get(slug) ?? '' });
        }
      }
      const narrRes = await generateSynthesisNarrative({ diff: synthDiff, recentWikiUpdates: recentUpdates, claudeOpts });
      synthNarrative = narrRes.narrative;
      synthNarrCost = narrRes.costUsd ?? 0;
      log('synth-narrative', narrRes);
      writeFileSync(join(iterDir, 'synth-narrative.md'), synthNarrative + '\n');
    }
    for (const archSlug of archInvalidated) {
      const wikiExcerpts = wikiExcerptsFor(archSlug, archSourcemap, repoState);
      const existing = archBodies.get(archSlug) ?? '';
      const res = await patchArchPage({ archSlug, existingPage: existing, narrative: synthNarrative, wikiExcerpts, changeReasons: reasons[archSlug] ?? [], claudeOpts });
      archBodies.set(archSlug, res.content);
      archPages.set(archSlug, res.content);
      log('arch-patch', res); synthesisCost += res.costUsd ?? 0;
    }
    iterRecord.synthesis = { mode: 'incremental', invalidated: archInvalidated, cost: synthesisCost, narrativeCost: synthNarrCost };
    iterRecord.cost.narrative += synthNarrCost;
  }
  iterRecord.cost.synthesis = synthesisCost;
  prevSynthSnap = synthSnap;

  const archDir = join(iterDir, 'arch');
  mkdirSync(archDir, { recursive: true });
  for (const [slug, body] of archPages) writeFileSync(join(archDir, slug.replace(/[/]/g, '_')), body);

  // Step 3: full from-scratch synthesis for comparison (every iteration)
  const fullArchPages = new Map();
  let fullSynthCost = 0;
  for (const archSlug of Object.keys(DEFAULT_ARCH_TAXONOMY)) {
    const wikiExcerpts = wikiExcerptsFor(archSlug, archSourcemap, repoState);
    const res = await generateArchPage({ archSlug, wikiExcerpts, claudeOpts });
    fullArchPages.set(archSlug, res.content);
    log('arch-full', res); fullSynthCost += res.costUsd ?? 0;
  }
  const fullDir = join(iterDir, 'arch-full');
  mkdirSync(fullDir, { recursive: true });
  for (const [slug, body] of fullArchPages) writeFileSync(join(fullDir, slug.replace(/[/]/g, '_')), body);
  iterRecord.synthesis.fullCost = fullSynthCost;

  // Step 4: judge incr vs full arch pages
  const judgeRes = [];
  for (const archSlug of Object.keys(DEFAULT_ARCH_TAXONOMY)) {
    if (!archPages.has(archSlug) || !fullArchPages.has(archSlug)) continue;
    const v = await judge({ pageA: archPages.get(archSlug), pageB: fullArchPages.get(archSlug), context: `Both pages document arch slug "${archSlug}".`, claudeOpts });
    judgeRes.push({ slug: archSlug, score: v.score, equivalent: v.equivalent });
    log('judge', v);
  }
  iterRecord.synthesis.judge = judgeRes;
  iterRecord.cumulativeTotalCost = totalCost;

  console.log(`[iter ${iter}] wiki=$${iterRecord.cost.wiki.toFixed(3)} narrative=$${iterRecord.cost.narrative.toFixed(3)} synth=$${synthesisCost.toFixed(3)} full-synth=$${fullSynthCost.toFixed(3)} cumul=$${totalCost.toFixed(2)}`);
  console.log(`        arch invalidated: ${iterRecord.synthesis.invalidated?.join(', ') || '(full)'}`);
  console.log(`        judge: ${judgeRes.map((j) => `${j.slug}=${j.score}`).join('  ')}`);

  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);
}

// final report
const summary = {
  model: MODEL,
  iters: N_ITERS,
  cumulativeCost: totalCost,
  perIter: iterReports.map((r) => ({
    iter: r.iter, date: r.date,
    wikiCost: r.cost.wiki, narrativeCost: r.cost.narrative, synthCost: r.cost.synthesis,
    fullSynthCost: r.synthesis?.fullCost,
    archInvalidated: r.synthesis?.invalidated,
    archJudge: r.synthesis?.judge,
    cumulativeTotalCost: r.cumulativeTotalCost,
  })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

console.log('\n=== TIMELINE SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total spent: $${totalCost.toFixed(2)}`);
console.log(`reports: ${OUT_ROOT}/iter-{0..${N_ITERS}}/report.json`);
console.log(`summary: ${OUT_ROOT}/summary.json`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });

function slugFor(sym) {
  const kindDir = { class: 'entities', interface: 'entities', type: 'types', function: 'logic', enum: 'enums', const: 'consts', Deployment: 'entities', Service: 'entities', ConfigMap: 'entities', Kustomization: 'entities' }[sym.kind] ?? 'misc';
  const safe = sym.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${kindDir}/${safe}.md`;
}

function wikiExcerptsFor(archSlug, sourcemap, repoState) {
  const page = sourcemap.pages?.[archSlug];
  if (!page) return [];
  const refs = page.wikiRefs ?? [];
  return refs
    .slice(0, 25)  // cap to avoid huge prompts
    .map(({ repo, slug }) => ({
      repo, slug,
      body: (repoState[repo].pageBodies.get(slug) ?? '').slice(0, 2500),
    }))
    .filter((x) => x.body);
}

async function pickShaByDate(git, date) {
  const log = await git.log({ '--until': `${date}T23:59:59` });
  if (!log.all.length) throw new Error(`No commits before ${date}`);
  return log.all[0].hash;
}
