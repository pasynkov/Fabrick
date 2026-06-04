#!/usr/bin/env node
// Per-page synthesis drift bench.
//
// Reads cached per-repo wiki snapshots from .lab/wiki-drift/iter-{0..N}/<repo>/wiki-incremental/after/
//
// iter 0:  discover STABLE taxonomy (1 LLM call) → generate all project pages per slug
//          + generate mcp-description + mcp-instructions (separate steps)
// iter >0: compute wiki patch (added/changed/deleted slugs per repo) → patch only affected
//          project pages (one LLM call each)
//
// Full rebuild ground truth each iter (per-page generate all).
// Judge sample of shared slugs each iter.
//
// Artifacts (full visibility):
// .lab/synthesis-drift/
//   iter-N/
//     synthesis-incremental/
//       before/                 project wiki state BEFORE iter N
//       taxonomy.json           (iter 0 only) discovered taxonomy
//       taxonomy-call/          (iter 0 only) discovery LLM call
//       wiki-patch.json         (iter > 0) computed wiki patch summary
//       patches/<archSlug>/     per-page LLM calls
//         action.txt, existing-body.md, wiki-patch-summary.txt,
//         prompt.txt, llm-response.md
//       mcp/                    mcp-description, mcp-instructions calls
//       after/                  project wiki state AFTER iter N
//     synthesis-fullrebuild/
//       pages/                  ground-truth project wiki pages
//       calls/<archSlug>/       per-page generate call
//     judge/sample.json
//     report.json
//   summary.json
//   README.md

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { discoverTaxonomy, flattenArchSources, affectedArchSlugsByFiles, pruneTaxonomy } from '../src/synthesis/taxonomy.js';
import { generateArchPage, patchArchPage, generateMcpDescription, generateMcpInstructions } from '../src/synthesis/page-generator.js';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { synthSourcemap } from '../src/bench/synth-sourcemap.js';
import { judge } from '../src/llm/judge.js';
import { stableJson } from '../src/snapshot/store.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const WIKI_ROOT = argv.find((a) => a.startsWith('--wiki-root='))?.split('=')[1] ?? '.lab/wiki-drift';
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 5);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 25);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4);
const JUDGE_SAMPLE = Number(argv.find((a) => a.startsWith('--judge-sample='))?.split('=')[1] ?? 5);

const REPOS = [
  { name: 'backend1', path: process.env.NAMI_REPO_BACKEND1, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
  { name: 'kustomize', path: process.env.NAMI_REPO_KUSTOMIZE, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
];
const REPO_NAMES = REPOS.map((r) => r.name);

if (!existsSync(WIKI_ROOT)) {
  console.error(`Wiki snapshot root missing: ${WIKI_ROOT}. Run wiki-drift-bench.js first.`);
  process.exit(1);
}
for (const r of REPOS) {
  if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }
}

// Clone repos + resolve SHAs per iter so we can compute file-level diffs
const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `sd-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () => simpleGit(r.path).clone(r.path, tmp));
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    sourceShas[date] = raw.trim();
  }
  repoState[r.name] = { tmp, git: simpleGit(tmp), sourceShas, dates: r.dates };
}

async function buildWikiSourcemapAt(repoName, iter) {
  const r = REPOS.find((x) => x.name === repoName);
  const state = repoState[repoName];
  const sha = state.sourceShas[state.dates[iter]];
  await state.git.checkout(sha);
  const snap = buildSnapshot(state.tmp);
  return { snap, sourcemap: synthSourcemap(snap) };
}

function fileDiff(beforeFiles, afterFiles) {
  const before = beforeFiles ?? {};
  const after = afterFiles ?? {};
  const added = [], changed = [], deleted = [];
  for (const f of Object.keys(after)) {
    if (!(f in before)) added.push(f);
    else if (before[f].hash !== after[f].hash) changed.push(f);
  }
  for (const f of Object.keys(before)) if (!(f in after)) deleted.push(f);
  return { added: added.sort(), changed: changed.sort(), deleted: deleted.sort() };
}

const OUT_ROOT = join(process.cwd(), '.lab', 'synthesis-drift');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const accrue = (res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded (now $${totalCost.toFixed(2)})`);
};

let taxonomy = null;
const archBodies = new Map();   // archSlug → markdown body
const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  const incrDir = join(iterDir, 'synthesis-incremental');
  const fullDir = join(iterDir, 'synthesis-fullrebuild');
  const judgeDir = join(iterDir, 'judge');
  const beforeDir = join(incrDir, 'before');
  const patchesDir = join(incrDir, 'patches');
  const afterDir = join(incrDir, 'after');
  const mcpDir = join(incrDir, 'mcp');
  const fullPagesDir = join(fullDir, 'pages');
  const fullCallsDir = join(fullDir, 'calls');
  for (const d of [beforeDir, patchesDir, afterDir, mcpDir, fullPagesDir, fullCallsDir, judgeDir]) {
    mkdirSync(d, { recursive: true });
  }

  // Snapshot BEFORE
  for (const [slug, body] of archBodies) writeFileSync(join(beforeDir, safeFile(slug)), body);

  // Load wiki for this iteration
  const perRepoWiki = {};
  for (const repo of REPO_NAMES) {
    const dir = join(WIKI_ROOT, `iter-${iter}`, repo, 'wiki-incremental', 'after');
    if (!existsSync(dir)) { console.error(`Missing wiki snapshot: ${dir}`); process.exit(1); }
    perRepoWiki[repo] = loadWikiDir(dir);
  }
  // Also build per-repo wiki sourcemap (for file mapping) and snapshot (for file hashes)
  const perRepoWikiSourcemaps = {};
  const perRepoFiles = {};
  for (const repo of REPO_NAMES) {
    const { snap, sourcemap } = await buildWikiSourcemapAt(repo, iter);
    perRepoWikiSourcemaps[repo] = sourcemap;
    perRepoFiles[repo] = snap.files;
  }
  console.log(`[iter ${iter}] loaded wiki: ${REPO_NAMES.map((r) => `${r}=${Object.keys(perRepoWiki[r]).length}`).join(' ')}  files: ${REPO_NAMES.map((r) => `${r}=${Object.keys(perRepoFiles[r]).length}`).join(' ')}`);

  let incrCost = 0;
  let mcpCost = 0;

  if (iter === 0) {
    // Phase 1: discover taxonomy (one LLM call) and flatten sources from wiki sourcemaps
    console.log(`[iter ${iter}] discovering taxonomy...`);
    const disc = await discoverTaxonomy({ perRepoPageBodies: perRepoWiki, claudeOpts });
    taxonomy = flattenArchSources({ taxonomy: disc.taxonomy, perRepoWikiSourcemaps });
    writeFileSync(join(incrDir, 'taxonomy.json'), stableJson(taxonomy));
    const taxoCallDir = join(incrDir, 'taxonomy-call');
    mkdirSync(taxoCallDir, { recursive: true });
    writeFileSync(join(taxoCallDir, 'prompt.txt'), disc.prompt);
    writeFileSync(join(taxoCallDir, 'llm-response.md'), disc.rawResponse);
    accrue(disc); incrCost += disc.costUsd ?? 0;
    console.log(`[iter ${iter}] taxonomy: ${taxonomy.pages.length} arch pages`);
    for (const p of taxonomy.pages) console.log(`        ${p.archSlug}  (${p.wikiRefs.length} refs)`);

    // Phase 2: per-page generation (parallel)
    const jobs = taxonomy.pages.map((page) => ({ page, wikiExcerpts: wikiExcerptsFor(page, perRepoWiki) }));
    const results = await pMap(jobs, async (j) => {
      const res = await generateArchPage({ page: j.page, wikiExcerpts: j.wikiExcerpts, claudeOpts });
      return { ...j, res };
    }, { concurrency: CONCURRENCY });
    for (const { page, res } of results) {
      archBodies.set(page.archSlug, res.content);
      const slugDir = join(patchesDir, safeFile(page.archSlug).replace(/\.md$/, ''));
      mkdirSync(slugDir, { recursive: true });
      writeFileSync(join(slugDir, 'action.txt'), 'baseline-generate\n');
      writeFileSync(join(slugDir, 'prompt.txt'), res.prompt);
      writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse);
      accrue(res); incrCost += res.costUsd ?? 0;
    }

    // Phase 3: mcp pages (separate)
    const [descRes, instrRes] = await Promise.all([
      generateMcpDescription({ taxonomy, repos: REPO_NAMES, claudeOpts }),
      generateMcpInstructions({ taxonomy, repos: REPO_NAMES, claudeOpts }),
    ]);
    archBodies.set('mcp-description.md', descRes.content);
    archBodies.set('mcp-instructions.md', instrRes.content);
    writeFileSync(join(mcpDir, 'mcp-description.prompt.txt'), descRes.prompt);
    writeFileSync(join(mcpDir, 'mcp-description.response.md'), descRes.rawResponse);
    writeFileSync(join(mcpDir, 'mcp-instructions.prompt.txt'), instrRes.prompt);
    writeFileSync(join(mcpDir, 'mcp-instructions.response.md'), instrRes.rawResponse);
    accrue(descRes); accrue(instrRes); mcpCost += (descRes.costUsd ?? 0) + (instrRes.costUsd ?? 0);
  } else {
    // File-level patch: compute file diff per repo between iter and iter-1
    const prevFiles = {};
    for (const repo of REPO_NAMES) {
      const { snap } = await buildWikiSourcemapAt(repo, iter - 1);
      prevFiles[repo] = snap.files;
    }
    const fileDiffByRepo = {};
    for (const repo of REPO_NAMES) fileDiffByRepo[repo] = fileDiff(prevFiles[repo], perRepoFiles[repo]);
    const patchSummary = REPO_NAMES.map((r) => {
      const d = fileDiffByRepo[r];
      return `${r}: +${d.added.length}/~${d.changed.length}/-${d.deleted.length} files`;
    }).join('  ');
    console.log(`[iter ${iter}] file diff: ${patchSummary}`);
    writeFileSync(join(incrDir, 'file-diff.json'), stableJson(fileDiffByRepo));

    // Re-flatten taxonomy with current wiki sourcemaps (sources may have shifted)
    taxonomy = flattenArchSources({ taxonomy, perRepoWikiSourcemaps });

    if (Object.values(fileDiffByRepo).every((d) => !d.added.length && !d.changed.length && !d.deleted.length)) {
      console.log(`[iter ${iter}] no file changes — synthesis no-op`);
    } else {
      // File-level invalidation: arch pages whose source files intersect with diff
      const { affected, reasons: fileReasons } = affectedArchSlugsByFiles({ taxonomy, fileDiffByRepo });
      console.log(`[iter ${iter}] affected arch pages (file-level): ${affected.length}/${taxonomy.pages.length}`);
      writeFileSync(join(incrDir, 'invalidation-reasons.json'), stableJson(fileReasons));

      const jobs = affected.map((page) => ({
        page,
        wikiExcerpts: wikiExcerptsFor(page, perRepoWiki),
        wikiPatchSummary: buildFileLevelSummary(page, fileReasons[page.archSlug] ?? []),
      }));
      const results = await pMap(jobs, async (j) => {
        const existing = archBodies.get(j.page.archSlug) ?? '';
        const res = await patchArchPage({ page: j.page, existingPage: existing, wikiExcerpts: j.wikiExcerpts, wikiPatchSummary: j.wikiPatchSummary, claudeOpts });
        return { ...j, existing, res };
      }, { concurrency: CONCURRENCY });
      for (const { page, existing, wikiPatchSummary, res } of results) {
        archBodies.set(page.archSlug, res.content);
        const slugDir = join(patchesDir, safeFile(page.archSlug).replace(/\.md$/, ''));
        mkdirSync(slugDir, { recursive: true });
        writeFileSync(join(slugDir, 'action.txt'), 'patch\n');
        writeFileSync(join(slugDir, 'existing-body.md'), existing);
        writeFileSync(join(slugDir, 'wiki-patch-summary.txt'), wikiPatchSummary);
        writeFileSync(join(slugDir, 'prompt.txt'), res.prompt);
        writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse);
        accrue(res); incrCost += res.costUsd ?? 0;
      }
    }
  }

  // Snapshot AFTER
  for (const [slug, body] of archBodies) writeFileSync(join(afterDir, safeFile(slug)), body);

  // FULL REBUILD (ground truth)
  const fullBodies = new Map();
  let fullCost = 0;
  if (iter === 0) {
    for (const [slug, body] of archBodies) {
      fullBodies.set(slug, body);
      writeFileSync(join(fullPagesDir, safeFile(slug)), body);
    }
    writeFileSync(join(fullDir, 'NOTE.md'), 'iter-0: full == incremental (same taxonomy, same gen pass)\n');
  } else {
    const jobs = taxonomy.pages.map((page) => ({ page, wikiExcerpts: wikiExcerptsFor(page, perRepoWiki) }));
    const results = await pMap(jobs, async (j) => {
      const res = await generateArchPage({ page: j.page, wikiExcerpts: j.wikiExcerpts, claudeOpts });
      return { ...j, res };
    }, { concurrency: CONCURRENCY });
    for (const { page, res } of results) {
      fullBodies.set(page.archSlug, res.content);
      writeFileSync(join(fullPagesDir, safeFile(page.archSlug)), res.content);
      const slugDir = join(fullCallsDir, safeFile(page.archSlug).replace(/\.md$/, ''));
      mkdirSync(slugDir, { recursive: true });
      writeFileSync(join(slugDir, 'prompt.txt'), res.prompt);
      writeFileSync(join(slugDir, 'llm-response.md'), res.rawResponse);
      accrue(res); fullCost += res.costUsd ?? 0;
    }
  }

  // Judge sample
  const shared = [...archBodies.keys()].filter((s) => fullBodies.has(s));
  const sample = shared.slice(0, JUDGE_SAMPLE);
  const verdicts = await pMap(sample, async (slug) => {
    const v = await judge({ pageA: archBodies.get(slug), pageB: fullBodies.get(slug), context: `Both pages document project wiki slug "${slug}".`, claudeOpts });
    return { slug, score: v.score, equivalent: v.equivalent, differences: v.differences ?? [], _raw: v };
  }, { concurrency: CONCURRENCY });
  let judgeCost = 0;
  for (const v of verdicts) { accrue(v._raw); judgeCost += v._raw?.costUsd ?? 0; delete v._raw; }
  writeFileSync(join(judgeDir, 'sample.json'), stableJson({ slugs: sample, verdicts }));

  const avgScore = verdicts.length ? verdicts.reduce((s, v) => s + (v.score ?? 0), 0) / verdicts.length : null;
  const iterRecord = {
    iter,
    pagesIncr: archBodies.size,
    pagesFull: fullBodies.size,
    taxonomyPages: taxonomy?.pages.length ?? 0,
    cost: { incremental: incrCost, mcp: mcpCost, fullRebuild: fullCost, judge: judgeCost },
    avgJudgeScore: avgScore,
    verdicts,
    cumulativeTotalCost: totalCost,
  };
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  console.log(`[iter ${iter}] incr=$${incrCost.toFixed(3)} mcp=$${mcpCost.toFixed(3)} full=$${fullCost.toFixed(3)} judge=$${judgeCost.toFixed(3)}  cumul=$${totalCost.toFixed(2)}`);
  console.log(`        pagesIncr=${archBodies.size} pagesFull=${fullBodies.size} avgJudge=${avgScore?.toFixed(2) ?? 'n/a'}`);
  console.log(`        ${verdicts.map((v) => `${v.slug.replace(/\.md$/, '')}=${v.score}`).join('  ')}`);
}

const summary = {
  model: MODEL,
  iters: N_ITERS,
  cumulativeCost: totalCost,
  taxonomyPages: taxonomy?.pages.length ?? 0,
  perIter: iterReports.map((r) => ({
    iter: r.iter,
    cost: r.cost,
    pagesIncr: r.pagesIncr,
    pagesFull: r.pagesFull,
    avgJudgeScore: r.avgJudgeScore,
    cumulativeTotalCost: r.cumulativeTotalCost,
  })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

writeFileSync(join(OUT_ROOT, 'README.md'), `# Per-page synthesis drift bench

Uses cached wiki snapshots from \`${WIKI_ROOT}/iter-*/<repo>/wiki-incremental/after/\`.

Iter 0: discover STABLE taxonomy (1 LLM call), generate every project page,
generate mcp-description + mcp-instructions (separate calls).

Iter N: compute wiki patch, patch only affected project pages.

Per-iter layout:
\`\`\`
iter-N/
  synthesis-incremental/
    before/                project wiki state BEFORE iter N
    taxonomy.json          (iter 0) discovered taxonomy
    taxonomy-call/         (iter 0) discovery LLM call
    wiki-patch.json        (iter > 0) wiki diff summary
    patches/<archSlug>/    per-page LLM call artifacts
    mcp/                   mcp-description + mcp-instructions
    after/                 project wiki state AFTER iter N
  synthesis-fullrebuild/
    pages/                 ground-truth pages
    calls/<archSlug>/      per-page generate prompt + response
  judge/sample.json
  report.json
\`\`\`
`);

console.log('\n=== SYNTHESIS-DRIFT SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total: $${totalCost.toFixed(2)}`);
console.log(`taxonomy: ${taxonomy?.pages.length ?? 0} arch pages`);
console.log(`summary: ${OUT_ROOT}/summary.json`);

function safeFile(slug) {
  const safe = slug.endsWith('.md') ? slug : slug + '.md';
  return safe.replace(/[/]/g, '_');
}

function loadWikiDir(dir) {
  const out = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const slug = name.replace(/_/g, '/');
    out[slug] = readFileSync(join(dir, name), 'utf8');
  }
  return out;
}

function loadAllIter(root, iter) {
  const out = {};
  for (const repo of REPO_NAMES) {
    const dir = join(root, `iter-${iter}`, repo, 'wiki-incremental', 'after');
    out[repo] = existsSync(dir) ? loadWikiDir(dir) : {};
  }
  return out;
}

function wikiExcerptsFor(page, perRepoWiki) {
  return (page.wikiRefs ?? []).map(({ repo, slug }) => ({
    repo, slug,
    body: (perRepoWiki[repo]?.[slug] ?? '').slice(0, 4000),
  })).filter((x) => x.body);
}

function buildFileLevelSummary(page, hitRepos) {
  if (!hitRepos.length) return '(no direct file changes; cascade only)';
  return hitRepos.map(({ repo, files }) => `  ${repo}: ${files.slice(0, 10).join(', ')}${files.length > 10 ? ` (+${files.length - 10} more)` : ''}`).join('\n');
}

function buildWikiPatchSummaryForPage_OLD(page, wikiPatchByRepo) {
  const refKey = (r, s) => `${r}::${s}`;
  const myRefs = new Set((page.wikiRefs ?? []).map((r) => refKey(r.repo, r.slug)));
  const lines = [];
  for (const [repo, patch] of Object.entries(wikiPatchByRepo)) {
    const affecting = [];
    for (const item of patch.added) if (myRefs.has(refKey(repo, item.slug))) affecting.push(`+${item.slug}`);
    for (const item of patch.changed) if (myRefs.has(refKey(repo, item.slug))) affecting.push(`~${item.slug}`);
    for (const slug of patch.deleted) if (myRefs.has(refKey(repo, slug))) affecting.push(`-${slug}`);
    if (affecting.length) lines.push(`  ${repo}: ${affecting.join(', ')}`);
  }
  return lines.length ? lines.join('\n') : '(no direct ref changes; consumer cascade only)';
}
