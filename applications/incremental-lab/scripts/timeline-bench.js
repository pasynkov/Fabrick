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
import { synthesizeFull, synthesizeIncremental } from '../src/synthesis/page-generator.js';
import { judge } from '../src/llm/judge.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 3);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 20);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 5);

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
  // Pre-compute SHAs for all iteration dates BEFORE any checkout
  // (checkout moves HEAD and contaminates date-based log queries).
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    const sha = raw.trim();
    if (!sha) throw new Error(`${r.name}: no commit before ${date}`);
    sourceShas[date] = sha;
  }
  console.log(`[${r.name}] iteration SHAs:`, Object.entries(sourceShas).map(([d, s]) => `${d}=${s.slice(0,7)}`).join(' '));
  repoState[r.name] = {
    tmp,
    git: simpleGit(tmp),
    sourceShas,
    snap: null,
    smap: null,
    pageBodies: new Map(),
    pages: new Map(),
    role: r.role,
    subdir: r.subdir,
    dates: r.dates,
  };
}

// arch (project wiki) state across iterations
const archBodies = new Map();       // slug → markdown body
let prevSynthSnap = null;

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} (${iter === 0 ? 'baseline' : `+${iter}`}) ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });

  const iterRecord = { iter, date: null, repos: {}, synthesis: null, cost: { wiki: 0, narrative: 0, synthesis: 0 } };

  // Step 1: advance each repo, wiki update (parallel across repos)
  await pMap(REPOS, async (r) => {
    const state = repoState[r.name];
    const date = state.dates[iter];
    iterRecord.date = date;
    const sha = state.sourceShas[date];
    console.log(`[${r.name}] checkout ${sha.slice(0,7)} (${date})`);
    await state.git.checkout(sha);
    const subPath = join(state.tmp, state.subdir);

    const repoDir = join(iterDir, 'wiki-incremental', r.name);
    const patchesDir = join(repoDir, 'patches');
    const beforeDir = join(repoDir, 'before');
    const afterDir = join(repoDir, 'after');
    mkdirSync(patchesDir, { recursive: true });
    mkdirSync(beforeDir, { recursive: true });
    mkdirSync(afterDir, { recursive: true });

    // Snapshot wiki BEFORE this iteration's patches (only meaningful for iter > 0)
    for (const [slug, content] of state.pages) writeFileSync(join(beforeDir, safeFile(slug)), content);

    if (iter === 0) {
      // baseline full scan — parallel page generation
      state.snap = buildSnapshot(subPath);
      state.smap = synthSourcemap(state.snap);
      console.log(`[${r.name}] baseline files=${Object.keys(state.snap.files).length} symbols=${state.snap.symbols.length} pages=${Object.keys(state.smap.pages).length - 1}`);
      const jobs = Object.entries(state.smap.pages)
        .filter(([slug, p]) => slug !== 'index.md' && p.symbols.length > 0)
        .map(([slug, page]) => ({ slug, page, symbols: state.snap.symbols.filter((s) => page.symbols.includes(s.id)) }));
      const t0 = Date.now();
      const results = await pMap(jobs, async (j) => {
        const res = await generatePage({ slug: j.slug, symbols: j.symbols, repoRoot: subPath, claudeOpts });
        return { slug: j.slug, page: j.page, res };
      }, { concurrency: CONCURRENCY });
      console.log(`[${r.name}] baseline ${jobs.length} pages done in ${((Date.now() - t0)/1000).toFixed(1)}s (concurrency=${CONCURRENCY})`);
      let repoCost = 0;
      for (const { slug, page, res } of results) {
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        // save generation artifact
        const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'baseline-generate\n');
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '(prompt not captured)');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
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
      // parallel patches
      const patchJobs = inv.pagesInvalidated
        .filter((slug) => slug !== 'index.md')
        .map((slug) => ({ slug, page: state.smap.pages[slug] }))
        .filter((j) => j.page && j.page.symbols.length > 0)
        .map((j) => ({ ...j, symbols: after.symbols.filter((s) => j.page.symbols.includes(s.id)) }))
        .filter((j) => j.symbols.length > 0);
      // save narrative artifact
      if (narrative) writeFileSync(join(repoDir, 'narrative.md'), narrative + '\n');

      const patchResults = await pMap(patchJobs, async (j) => {
        const existingBody = state.pageBodies.get(j.slug) ?? '';
        const res = await patchPage({
          slug: j.slug, existingPage: existingBody, changes: inv.reasons[j.slug] ?? [],
          symbols: j.symbols, repoRoot: subPath, claudeOpts,
          beforeSnapshotSymbols: before.symbols, afterSnapshotSymbols: after.symbols,
        });
        return { ...j, existingBody, res };
      }, { concurrency: CONCURRENCY });
      const patchedSlugs = [];
      for (const { slug, page, existingBody, res } of patchResults) {
        state.pageBodies.set(slug, res.content);
        const related = computeRelated({ slug, sourcemap: state.smap, snapshot: state.snap });
        state.pages.set(slug, assemblePage({ slug, body: res.content, page, sourcemap: state.smap, snapshot: state.snap, relatedSlugs: related, updated: sha.slice(0,7) }));
        // save patch artifact
        const slugDir = join(patchesDir, safeFile(slug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'patch\n');
        writeFileSync(join(slugDir, 'existing-body.md'), existingBody);
        writeFileSync(join(slugDir, 'change-reasons.txt'), (inv.reasons[slug] ?? []).join('\n') + '\n');
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt ?? '');
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse ?? res.content);
        patchedSlugs.push(slug);
        log('patch', res); repoCost += res.costUsd ?? 0;
      }
      // parallel new-symbol page generations
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

    // Snapshot AFTER: final wiki state for this iteration
    for (const [slug, content] of state.pages) writeFileSync(join(afterDir, safeFile(slug)), content);
  }, { concurrency: 2 });

  // Step 2: synthesis layer (production-aligned: single-call concept-centric)
  const perRepoWikiPages = {};
  for (const r of REPOS) {
    perRepoWikiPages[r.name] = {};
    for (const [slug, body] of repoState[r.name].pageBodies) perRepoWikiPages[r.name][slug] = body;
  }
  const synthSnap = buildSynthesisSnapshot(perRepoWikiPages);

  const archDir = join(iterDir, 'synthesis-incremental');
  const archBeforeDir = join(archDir, 'before');
  const archAfterDir = join(archDir, 'after');
  const archCallDir = join(archDir, 'call');
  const archFullDir = join(iterDir, 'synthesis-fullrebuild');
  const archFullCallDir = join(archFullDir, 'call');
  mkdirSync(archBeforeDir, { recursive: true });
  mkdirSync(archAfterDir, { recursive: true });
  mkdirSync(archCallDir, { recursive: true });
  mkdirSync(archFullDir, { recursive: true });
  mkdirSync(archFullCallDir, { recursive: true });

  // Snapshot project wiki BEFORE this iteration
  for (const [slug, body] of archBodies) writeFileSync(join(archBeforeDir, safeFile(slug.endsWith('.md') ? slug : slug + '.md')), body);

  let synthesisCost = 0;
  let synthResults = null;
  if (iter === 0) {
    // baseline full synthesis: one LLM call, all pages produced
    const repos = REPOS.map((r) => ({ name: r.name, pages: perRepoWikiPages[r.name] }));
    synthResults = await synthesizeFull({ repos, claudeOpts });
    for (const p of synthResults.pages) archBodies.set(p.slug, p.body);
    writeFileSync(join(archCallDir, 'action.txt'), 'baseline-full\n');
    writeFileSync(join(archCallDir, 'prompt.txt'), synthResults.prompt ?? '');
    writeFileSync(join(archCallDir, 'llm-response.md'), synthResults.rawResponse ?? '');
    log('synth-full', synthResults); synthesisCost += synthResults.costUsd ?? 0;
    iterRecord.synthesis = { mode: 'full', pagesProduced: synthResults.pages.length, deletions: synthResults.deletions.length, cost: synthesisCost };
  } else {
    // incremental synthesis: pass changed repos full, unchanged as index-only,
    // existing project pages that might overlap with changes
    const synthDiff = diffSynthesisSnapshots(prevSynthSnap, synthSnap);
    const changedRepoNames = new Set(Object.entries(synthDiff).filter(([, c]) => c.added.length || c.changed.length || c.deleted.length).map(([n]) => n));
    const changedRepos = REPOS.filter((r) => changedRepoNames.has(r.name)).map((r) => ({ name: r.name, pages: perRepoWikiPages[r.name] }));
    const unchangedRepos = REPOS.filter((r) => !changedRepoNames.has(r.name)).map((r) => ({ name: r.name, indexBody: perRepoWikiPages[r.name]['index.md'] ?? '' }));
    const existingPages = [...archBodies.entries()].map(([slug, body]) => ({ slug, body }));

    if (!diffHasChanges(synthDiff)) {
      iterRecord.synthesis = { mode: 'no-change', pagesProduced: 0, deletions: 0, cost: 0 };
      synthResults = { pages: [], deletions: [], rawResponse: '', prompt: '' };
    } else {
      synthResults = await synthesizeIncremental({ changedRepos, unchangedRepos, existingPages, claudeOpts });
      for (const p of synthResults.pages) archBodies.set(p.slug, p.body);
      for (const slug of synthResults.deletions) archBodies.delete(slug);
      writeFileSync(join(archCallDir, 'action.txt'), 'incremental\n');
      writeFileSync(join(archCallDir, 'prompt.txt'), synthResults.prompt ?? '');
      writeFileSync(join(archCallDir, 'llm-response.md'), synthResults.rawResponse ?? '');
      log('synth-incr', synthResults); synthesisCost += synthResults.costUsd ?? 0;
      iterRecord.synthesis = { mode: 'incremental', pagesProduced: synthResults.pages.length, deletions: synthResults.deletions.length, changedRepos: [...changedRepoNames], cost: synthesisCost };
    }
    iterRecord.synthesis = { mode: 'incremental', invalidated: archInvalidated, cost: synthesisCost, narrativeCost: synthNarrCost };
    iterRecord.cost.narrative += synthNarrCost;
  }
  iterRecord.cost.synthesis = synthesisCost;
  prevSynthSnap = synthSnap;

  // Snapshot project wiki AFTER this iteration
  for (const [slug, body] of archBodies) writeFileSync(join(archAfterDir, safeFile(slug.endsWith('.md') ? slug : slug + '.md')), body);

  // Step 3: full from-scratch synthesis every iteration (ground truth for judge)
  const reposFull = REPOS.map((r) => ({ name: r.name, pages: perRepoWikiPages[r.name] }));
  const fullRes = await synthesizeFull({ repos: reposFull, claudeOpts });
  const fullArchPages = new Map();
  for (const p of fullRes.pages) {
    fullArchPages.set(p.slug, p.body);
    writeFileSync(join(archFullDir, safeFile(p.slug.endsWith('.md') ? p.slug : p.slug + '.md')), p.body);
  }
  writeFileSync(join(archFullCallDir, 'prompt.txt'), fullRes.prompt ?? '');
  writeFileSync(join(archFullCallDir, 'llm-response.md'), fullRes.rawResponse ?? '');
  log('arch-full', fullRes); const fullSynthCost = fullRes.costUsd ?? 0;
  iterRecord.synthesis.fullCost = fullSynthCost;
  iterRecord.synthesis.fullPagesProduced = fullRes.pages.length;

  // Step 4: judge incremental vs full pages — parallel, sample up to 5 shared slugs
  const sharedSlugs = [...archBodies.keys()].filter((s) => fullArchPages.has(s));
  const judgeSlugs = sharedSlugs.slice(0, 5);
  const judgeOuts = await pMap(judgeSlugs, async (slug) => {
    const v = await judge({ pageA: archBodies.get(slug), pageB: fullArchPages.get(slug), context: `Both pages document project wiki slug "${slug}".`, claudeOpts });
    return { slug, score: v.score, equivalent: v.equivalent, _raw: v };
  }, { concurrency: CONCURRENCY });
  const judgeRes = judgeOuts.map(({ slug, score, equivalent, _raw }) => {
    log('judge', _raw);
    return { slug, score, equivalent };
  });
  iterRecord.synthesis.judge = judgeRes;
  iterRecord.cumulativeTotalCost = totalCost;

  console.log(`[iter ${iter}] wiki=$${iterRecord.cost.wiki.toFixed(3)} narrative=$${iterRecord.cost.narrative.toFixed(3)} synth=$${synthesisCost.toFixed(3)} full-synth=$${fullSynthCost.toFixed(3)} cumul=$${totalCost.toFixed(2)}`);
  console.log(`        synth mode=${iterRecord.synthesis.mode} pages_produced=${iterRecord.synthesis.pagesProduced} deletions=${iterRecord.synthesis.deletions} full_pages=${iterRecord.synthesis.fullPagesProduced ?? '?'}`);
  console.log(`        judge: ${judgeRes.map((j) => `${j.slug.replace(/.md$/, '')}=${j.score}`).join('  ')}`);

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

const readme = `# Timeline bench output

Each iteration directory contains:

\`\`\`
iter-N/
  wiki-incremental/<repo>/        per-repo wiki layer (engine under test)
    before/                       wiki pages BEFORE applying this iteration's patches
                                  (empty in iter-0; for incremental iters: state inherited
                                   from iter-(N-1)/.../after/)
    patches/
      <slug-without-md>/
        action.txt                'baseline-generate' | 'patch' | 'new-page'
        existing-body.md          (patches only) what LLM saw as old page
        change-reasons.txt        (patches only) invalidator reasons
        prompt.txt                full prompt sent to LLM
        llm-response.md           raw LLM response (untouched)
    after/                        wiki pages AFTER applying this iteration's patches
    narrative.md                  (iter > 0) commit narrative for this repo

  synthesis-incremental/          project-level (cross-repo) wiki — engine under test
    before/                       arch pages BEFORE this iteration's synthesis patches
    patches/<archSlug>/...        same format as wiki patches
    after/                        arch pages AFTER patches
    narrative.md                  (iter > 0) synth-level cross-repo narrative

  synthesis-fullrebuild/          FULL from-scratch arch generation — ground truth for judge
                                  produced every iteration to compare incremental drift

  report.json                     per-iter cost, invalidations, judge scores
\`\`\`

\`summary.json\` aggregates cost ladder across iterations.
`;
writeFileSync(join(OUT_ROOT, 'README.md'), readme);

console.log('\n=== TIMELINE SUMMARY ===');
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

