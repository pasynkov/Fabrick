#!/usr/bin/env node
// Minimal-taxonomy wiki bench with full artifact visibility + drift judge.
//
// Per iter, per app scope:
//   - tree-sitter snapshot
//   - if iter 0:    baseline-full (1 LLM call → 4 pages)
//   - if change:    essence call + patch call (regenerate all 4 pages)
//   - always:       fresh from-scratch baseline as ground truth (1 LLM call)
//   - judge:        sample 1 page per scope, incr vs fullrebuild
//
// Artifacts per iter:
//   iter-N/
//     <repo>/index.md                    repo-level hierarchical TOC
//     <repo>/<scope>/
//       before/<slug>                    page state before this iter's patches
//       patch/
//         mode.txt                       baseline-full | patch | no-op
//         essence.json                   (patch only)
//         essence.prompt.txt
//         essence.response.md
//         patch.prompt.txt               single bulk-update prompt
//         patch.response.md              raw LLM response
//         features.json                  per-feature items
//       after/<slug>                     page state after this iter
//       fullrebuild/<slug>               ground truth (fresh full gen)
//       fullrebuild/prompt.txt
//       fullrebuild/response.md
//       judge/sample.json                judge verdicts vs ground truth
//       index.md                         scope-level page list
//   report.json
//
// summary.json: cost split (compute / apply / fullrebuild / judge), drift trend.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { detectScopes } from '../src/scope/monorepo.js';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { generateAppScope, patchAppScope } from '../src/wiki/app-page-generator.js';
import { APP_PAGE_SLUGS, APP_PAGES, affectedAppPages } from '../src/wiki/app-taxonomy.js';
import { extractEssence } from '../src/wiki/essence.js';
import { synthSourcemap } from '../src/bench/synth-sourcemap.js';
import { buildRepoIndex, buildScopeIndex } from '../src/wiki/monorepo-index.js';
import { stableJson } from '../src/snapshot/store.js';
import { judge } from '../src/llm/judge.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 5);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 15);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4);
const JUDGE_PAGES_PER_SCOPE = Number(argv.find((a) => a.startsWith('--judge-per-scope='))?.split('=')[1] ?? 1);

const REPOS = [
  { name: 'backend1', path: process.env.NAMI_REPO_BACKEND1, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
  { name: 'kustomize', path: process.env.NAMI_REPO_KUSTOMIZE, dates: ['2025-09-09','2025-09-15','2025-09-22','2025-09-28','2025-10-08','2025-10-13'] },
];
for (const r of REPOS) if (!r.path || !existsSync(r.path)) { console.error(`repo missing: ${r.name} ${r.path}`); process.exit(1); }

const OUT_ROOT = join(process.cwd(), '.lab', 'wiki-minimal');
rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

const claudeOpts = { model: MODEL };
let totalCost = 0;
const accrue = (res) => {
  totalCost += res.costUsd ?? 0;
  if (totalCost > MAX_COST) throw new Error(`max-cost $${MAX_COST} exceeded (now $${totalCost.toFixed(2)})`);
};

const repoState = {};
for (const r of REPOS) {
  const tmp = mkdtempSync(join(tmpdir(), `wmin-${r.name}-`));
  console.log(`[clone] ${r.name} → ${tmp}`);
  await simpleGit(r.path).clone(r.path, tmp, ['--no-local']).catch(async () => simpleGit(r.path).clone(r.path, tmp));
  const srcGit = simpleGit(r.path);
  const sourceShas = {};
  for (const date of r.dates) {
    const raw = await srcGit.raw(['log', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
    sourceShas[date] = raw.trim();
  }
  await simpleGit(tmp).checkout(sourceShas[r.dates[r.dates.length - 1]]);
  const scopes = detectScopes(tmp).filter((s) => s.kind === 'app');
  console.log(`[${r.name}] app scopes: ${scopes.length}`);

  repoState[r.name] = {
    tmp, git: simpleGit(tmp), srcGit, sourceShas, dates: r.dates, scopes,
    state: Object.fromEntries(scopes.map((s) => [s.root, {
      scope: s, snap: null, pages: {},
    }])),
  };
}

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });
  const iterRecord = {
    iter, repos: {},
    cost: { compute: 0, apply: 0, fullrebuild: 0, judge: 0 },
  };

  for (const r of REPOS) {
    const repoData = repoState[r.name];
    const sha = repoData.sourceShas[repoData.dates[iter]];
    console.log(`[${r.name}] checkout ${sha.slice(0,7)}`);
    await repoData.git.checkout(sha);
    iterRecord.repos[r.name] = { sha, scopes: {} };
    const repoOutDir = join(iterDir, r.name);
    mkdirSync(repoOutDir, { recursive: true });

    await pMap(repoData.scopes, async (scope) => {
      const state = repoData.state[scope.root];
      const scopePath = join(repoData.tmp, scope.root);
      const scopeOutDir = join(repoOutDir, scope.root.replace(/\//g, '__'));

      // Decide mode FIRST, before creating any directories.
      let mode = 'no-op';
      let snap = null;
      let diff = null;

      if (iter === 0) {
        snap = buildSnapshot(scopePath);
        state.snap = snap;
        const fileList = Object.keys(snap.files).sort();
        mode = fileList.length === 0 ? 'empty-scope' : 'baseline-full';
      } else {
        const before = state.snap;
        snap = buildSnapshot(scopePath);
        diff = diffSnapshots(before, snap);
        state.snap = snap;
        const affected = affectedAppPages(diff);
        mode = affected.length === 0 ? 'no-op' : 'patch';
      }

      // Skip ALL artifacts for no-op / empty-scope. State carries through.
      if (mode === 'no-op' || mode === 'empty-scope') {
        iterRecord.repos[r.name].scopes[scope.root] = {
          kind: scope.kind, name: scope.name, mode,
          cost: { compute: 0, apply: 0, fullrebuild: 0, judge: 0 },
          avgJudgeScore: null,
          verdicts: [],
        };
        return;
      }

      const beforeDir = join(scopeOutDir, 'before');
      const patchDir = join(scopeOutDir, 'patch');
      const afterDir = join(scopeOutDir, 'after');
      const fullDir = join(scopeOutDir, 'fullrebuild');
      const judgeDir = join(scopeOutDir, 'judge');
      for (const d of [beforeDir, patchDir, afterDir, fullDir, judgeDir]) mkdirSync(d, { recursive: true });

      for (const slug of APP_PAGE_SLUGS) writeFileSync(join(beforeDir, slug), state.pages[slug] ?? '(empty)\n');

      let computeCost = 0;
      let applyCost = 0;
      let fullrebuildCost = 0;
      let judgeCost = 0;

      if (mode === 'baseline-full') {
        const fileList = Object.keys(snap.files).sort();
        const res = await generateAppScope({
          scopePath, scopeName: scope.name, scopeKind: scope.kind, repoName: r.name,
          sourceFiles: fileList, claudeOpts,
        });
        accrue(res); applyCost = res.costUsd ?? 0;
        state.pages = res.pages;
        writeFileSync(join(patchDir, 'patch.prompt.txt'), res.prompt);
        writeFileSync(join(patchDir, 'patch.response.md'), res.rawResponse);
        writeFileSync(join(patchDir, 'mode.txt'), 'baseline-full\n');
      } else {
        // mode === 'patch'
        const sourcemap = synthSourcemap(snap);
        const changedFileContents = loadChangedFileContents(scopePath, diff);
        const beforeSha = repoData.sourceShas[repoData.dates[iter - 1]];
        const unifiedDiff = await computeUnifiedDiff(repoData.srcGit, beforeSha, sha, scope.root);
        const ess = await extractEssence({
          diff, sourcemap, repoName: r.name, scopeName: scope.name, scopeKind: scope.kind,
          changedFileContents, unifiedDiff, claudeOpts,
        });
        accrue(ess); computeCost = ess.costUsd ?? 0;
        writeFileSync(join(patchDir, 'essence.json'), stableJson({ features: ess.features }));
        writeFileSync(join(patchDir, 'essence.prompt.txt'), ess.prompt);
        writeFileSync(join(patchDir, 'essence.response.md'), ess.rawResponse);
        writeFileSync(join(patchDir, 'features.json'), stableJson(ess.features));

        const res = await patchAppScope({
          scopeName: scope.name, scopeKind: scope.kind, repoName: r.name,
          existingPages: state.pages,
          features: ess.features,
          claudeOpts,
        });
        accrue(res); applyCost = res.costUsd ?? 0;
        for (const slug of APP_PAGE_SLUGS) if (res.pages[slug]) state.pages[slug] = res.pages[slug];
        writeFileSync(join(patchDir, 'patch.prompt.txt'), res.prompt);
        writeFileSync(join(patchDir, 'patch.response.md'), res.rawResponse);
        writeFileSync(join(patchDir, 'mode.txt'), 'patch\n');
      }

      for (const slug of APP_PAGE_SLUGS) writeFileSync(join(afterDir, slug), state.pages[slug] ?? '(empty)\n');

      // Full from-scratch ground truth (only for actual changes).
      const fullPages = {};
      if (mode === 'baseline-full') {
        for (const slug of APP_PAGE_SLUGS) fullPages[slug] = state.pages[slug];
        writeFileSync(join(fullDir, 'NOTE.md'), 'iter-0: full == incremental (same gen pass)\n');
      } else {
        const fileList = Object.keys(snap.files).sort();
        if (fileList.length > 0) {
          const res = await generateAppScope({
            scopePath, scopeName: scope.name, scopeKind: scope.kind, repoName: r.name,
            sourceFiles: fileList, claudeOpts,
          });
          accrue(res); fullrebuildCost = res.costUsd ?? 0;
          for (const slug of APP_PAGE_SLUGS) fullPages[slug] = res.pages[slug];
          writeFileSync(join(fullDir, 'prompt.txt'), res.prompt);
          writeFileSync(join(fullDir, 'response.md'), res.rawResponse);
        }
      }
      for (const slug of APP_PAGE_SLUGS) writeFileSync(join(fullDir, slug), fullPages[slug] ?? '(empty)\n');

      const verdicts = [];
      if (Object.keys(fullPages).length > 0) {
        const candidates = APP_PAGE_SLUGS.filter((slug) => state.pages[slug] && fullPages[slug]);
        const sample = candidates.slice(0, JUDGE_PAGES_PER_SCOPE);
        for (const slug of sample) {
          const v = await judge({
            pageA: state.pages[slug], pageB: fullPages[slug],
            context: `Both pages document slug "${slug}" for scope "${scope.name}" in repo "${r.name}".`,
            claudeOpts,
          });
          verdicts.push({ slug, score: v.score, equivalent: v.equivalent, differences: v.differences ?? [] });
          accrue(v); judgeCost += v.costUsd ?? 0;
        }
        writeFileSync(join(judgeDir, 'sample.json'), stableJson({ verdicts }));
      }

      writeFileSync(join(scopeOutDir, 'index.md'),
        buildScopeIndex({ scope, pages: state.pages, sha }));

      const avgScore = verdicts.length ? verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length : null;
      iterRecord.repos[r.name].scopes[scope.root] = {
        kind: scope.kind, name: scope.name, mode,
        cost: { compute: computeCost, apply: applyCost, fullrebuild: fullrebuildCost, judge: judgeCost },
        avgJudgeScore: avgScore,
        verdicts,
      };
      iterRecord.cost.compute += computeCost;
      iterRecord.cost.apply += applyCost;
      iterRecord.cost.fullrebuild += fullrebuildCost;
      iterRecord.cost.judge += judgeCost;
    }, { concurrency: CONCURRENCY });

    const perScopeDescriptions = {};
    for (const [scopeRoot] of Object.entries(iterRecord.repos[r.name].scopes)) {
      const state = repoData.state[scopeRoot];
      const serviceBody = state.pages?.['service.md'] ?? '';
      perScopeDescriptions[scopeRoot] = firstSentenceFromMd(serviceBody);
    }
    writeFileSync(join(repoOutDir, 'index.md'),
      buildRepoIndex({ repoName: r.name, scopes: repoData.scopes, sha, perScopeDescriptions }));

    const summary = Object.values(iterRecord.repos[r.name].scopes)
      .filter((s) => s.mode !== 'no-op' && s.mode !== 'empty-scope')
      .map((s) => `${s.name}(${s.mode}/$${(s.cost.compute + s.cost.apply).toFixed(2)}/judge=${s.avgJudgeScore?.toFixed(2) ?? 'n/a'})`).join(' ');
    console.log(`        ${r.name}: ${summary || '(no scope changes)'}`);
  }

  iterRecord.cumulativeTotalCost = totalCost;
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  const allVerdicts = [];
  for (const repoInfo of Object.values(iterRecord.repos)) {
    for (const sc of Object.values(repoInfo.scopes)) {
      for (const v of sc.verdicts ?? []) allVerdicts.push(v.score);
    }
  }
  const iterAvg = allVerdicts.length ? (allVerdicts.reduce((s, v) => s + v, 0) / allVerdicts.length).toFixed(2) : 'n/a';
  console.log(`[iter ${iter}] compute=$${iterRecord.cost.compute.toFixed(2)} apply=$${iterRecord.cost.apply.toFixed(2)} fullrebuild=$${iterRecord.cost.fullrebuild.toFixed(2)} judge=$${iterRecord.cost.judge.toFixed(2)}  cumul=$${totalCost.toFixed(2)}  avgJudge=${iterAvg}`);
}

const summary = {
  model: MODEL, iters: N_ITERS, cumulativeCost: totalCost,
  perIter: iterReports.map((r) => {
    const verdicts = [];
    for (const repoInfo of Object.values(r.repos)) {
      for (const sc of Object.values(repoInfo.scopes)) {
        for (const v of sc.verdicts ?? []) verdicts.push(v.score);
      }
    }
    return {
      iter: r.iter,
      cost: r.cost,
      cumulativeTotalCost: r.cumulativeTotalCost,
      avgJudgeScore: verdicts.length ? verdicts.reduce((s, v) => s + v, 0) / verdicts.length : null,
      verdictCount: verdicts.length,
    };
  }),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

console.log('\n=== WIKI MINIMAL BENCH SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total spent: $${totalCost.toFixed(2)}`);
console.log(`split:  compute=$${iterReports.reduce((s, r) => s + r.cost.compute, 0).toFixed(2)}  apply=$${iterReports.reduce((s, r) => s + r.cost.apply, 0).toFixed(2)}  fullrebuild=$${iterReports.reduce((s, r) => s + r.cost.fullrebuild, 0).toFixed(2)}  judge=$${iterReports.reduce((s, r) => s + r.cost.judge, 0).toFixed(2)}`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });

const UNIFIED_DIFF_CAP = 50000;
async function computeUnifiedDiff(git, beforeSha, afterSha, scopeRoot) {
  try {
    const out = await git.diff([`${beforeSha}..${afterSha}`, '--unified=2', '--', scopeRoot]);
    if (out.length > UNIFIED_DIFF_CAP) return out.slice(0, UNIFIED_DIFF_CAP) + '\n... (truncated)';
    return out;
  } catch { return ''; }
}

function loadChangedFileContents(scopePath, diff) {
  const CHANGED_FILE_MAX_BYTES = 8000;
  const CHANGED_FILE_TOTAL_CAP = 40000;
  const out = {};
  const files = [...(diff.files?.changed ?? []), ...(diff.files?.added ?? [])];
  let total = 0;
  for (const rel of files) {
    let content;
    try { content = readFileSync(join(scopePath, rel), 'utf8'); }
    catch { continue; }
    if (content.length > CHANGED_FILE_MAX_BYTES) content = content.slice(0, CHANGED_FILE_MAX_BYTES) + '\n...';
    if (total + content.length > CHANGED_FILE_TOTAL_CAP) break;
    out[rel] = content;
    total += content.length;
  }
  return out;
}

function firstSentenceFromMd(body) {
  if (!body) return '';
  const lines = body.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('**')) continue;
    const m = t.match(/^[^.!?]{20,160}[.!?]/);
    if (m) return m[0];
    return t.length > 140 ? t.slice(0, 137) + '...' : t;
  }
  return '';
}
