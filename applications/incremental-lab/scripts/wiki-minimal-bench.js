#!/usr/bin/env node
// Minimal-taxonomy wiki bench: 4 fixed pages per app scope (service,
// contracts, config, integrations). Single LLM call per scope generates /
// updates all 4 pages at once. Libs are SKIPPED (internal plumbing).
//
// Per iter:
//   for each app scope:
//     1. tree-sitter snapshot
//     2. if any change since previous iter:
//        - baseline iter 0: generateAppScope (1 LLM call → 4 pages)
//        - incremental: patchAppScope (1 LLM call → 4 pages updated)
//     3. save pages
//
// Goal: drop per-iter cost to $0.05-0.30 by replacing N per-page calls with
// 1 per-scope call AND skipping libs entirely.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { detectScopes } from '../src/scope/monorepo.js';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { generateAppScope, patchAppScope } from '../src/wiki/app-page-generator.js';
import { APP_PAGE_SLUGS, affectedAppPages } from '../src/wiki/app-taxonomy.js';
import { extractEssence } from '../src/wiki/essence.js';
import { synthSourcemap } from '../src/bench/synth-sourcemap.js';
import { stableJson } from '../src/snapshot/store.js';
import { pMap } from '../src/util/concurrent.js';

const argv = process.argv.slice(2);
const N_ITERS = Number(argv.find((a) => a.startsWith('--iters='))?.split('=')[1] ?? 5);
const MAX_COST = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 10);
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4);

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
  // SKIP libs — only deployable apps
  const allScopes = detectScopes(tmp);
  const scopes = allScopes.filter((s) => s.kind === 'app');
  console.log(`[${r.name}] scopes (apps only): ${scopes.length}`);
  for (const s of scopes) console.log(`           ${s.name}  (${s.root})`);

  repoState[r.name] = {
    tmp, git: simpleGit(tmp), sourceShas, dates: r.dates, scopes,
    state: Object.fromEntries(scopes.map((s) => [s.root, {
      scope: s, snap: null, pages: {},  // pages: { slug: body }
    }])),
  };
}

const iterReports = [];

for (let iter = 0; iter <= N_ITERS; iter++) {
  console.log(`\n=== ITERATION ${iter} ===`);
  const iterDir = join(OUT_ROOT, `iter-${iter}`);
  mkdirSync(iterDir, { recursive: true });
  const iterRecord = { iter, repos: {}, cost: { baseline: 0, essence: 0, patch: 0 } };

  for (const r of REPOS) {
    const repoData = repoState[r.name];
    const sha = repoData.sourceShas[repoData.dates[iter]];
    console.log(`[${r.name}] checkout ${sha.slice(0,7)}`);
    await repoData.git.checkout(sha);
    iterRecord.repos[r.name] = { sha, scopes: {} };

    await pMap(repoData.scopes, async (scope) => {
      const state = repoData.state[scope.root];
      const scopePath = join(repoData.tmp, scope.root);
      const scopeOutDir = join(iterDir, r.name, scope.root.replace(/\//g, '__'));
      mkdirSync(scopeOutDir, { recursive: true });

      let scopeCost = 0;
      let essenceCost = 0;
      let patchCost = 0;
      let mode = 'no-op';

      if (iter === 0) {
        const snap = buildSnapshot(scopePath);
        state.snap = snap;
        const fileList = Object.keys(snap.files).sort();
        if (fileList.length === 0) { mode = 'empty-scope'; iterRecord.repos[r.name].scopes[scope.root] = { mode, cost: 0 }; return; }

        mode = 'baseline-full';
        const res = await generateAppScope({
          scopePath, scopeName: scope.name, scopeKind: scope.kind, repoName: r.name,
          sourceFiles: fileList, claudeOpts,
        });
        accrue(res); scopeCost = res.costUsd ?? 0;
        state.pages = res.pages;
        for (const slug of APP_PAGE_SLUGS) writeFileSync(join(scopeOutDir, slug), `# ${slug}\n\n${state.pages[slug] ?? '(empty)'}\n`);
        writeFileSync(join(scopeOutDir, 'llm-response.md'), res.rawResponse);
      } else {
        const before = state.snap;
        const after = buildSnapshot(scopePath);
        const diff = diffSnapshots(before, after);
        state.snap = after;

        const affected = affectedAppPages(diff);
        if (affected.length === 0) {
          mode = 'no-op';
        } else {
          // Phase 1: essence (small LLM call to summarize)
          const sourcemap = synthSourcemap(after);
          const ess = await extractEssence({
            diff, sourcemap, repoName: r.name, scopeName: scope.name, scopeKind: scope.kind, claudeOpts,
          });
          accrue(ess); essenceCost = ess.costUsd ?? 0;

          // Phase 2: single-call patch regenerating all 4 pages
          mode = 'patch';
          const fileList = Object.keys(after.files).sort();
          const res = await patchAppScope({
            scopePath, scopeName: scope.name, scopeKind: scope.kind, repoName: r.name,
            sourceFiles: fileList,
            existingPages: state.pages,
            features: ess.features,
            claudeOpts,
          });
          accrue(res); patchCost = res.costUsd ?? 0;
          // Merge — keep existing where model omitted
          for (const slug of APP_PAGE_SLUGS) {
            if (res.pages[slug]) state.pages[slug] = res.pages[slug];
          }
          for (const slug of APP_PAGE_SLUGS) writeFileSync(join(scopeOutDir, slug), `# ${slug}\n\n${state.pages[slug] ?? '(empty)'}\n`);
          writeFileSync(join(scopeOutDir, 'essence.json'), stableJson({ features: ess.features }));
          writeFileSync(join(scopeOutDir, 'llm-response.md'), res.rawResponse);
        }
      }

      iterRecord.repos[r.name].scopes[scope.root] = {
        kind: scope.kind, name: scope.name, mode,
        cost: { baseline: iter === 0 ? scopeCost : 0, essence: essenceCost, patch: patchCost },
      };
      iterRecord.cost.baseline += iter === 0 ? scopeCost : 0;
      iterRecord.cost.essence += essenceCost;
      iterRecord.cost.patch += patchCost;
    }, { concurrency: CONCURRENCY });

    const summary = Object.values(iterRecord.repos[r.name].scopes)
      .filter((s) => s.mode !== 'no-op')
      .map((s) => `${s.name}(${s.mode}/$${(s.cost.baseline + s.cost.essence + s.cost.patch).toFixed(2)})`).join(' ');
    console.log(`        ${r.name}: ${summary || '(no changes)'}`);
  }

  iterRecord.cumulativeTotalCost = totalCost;
  writeFileSync(join(iterDir, 'report.json'), stableJson(iterRecord));
  iterReports.push(iterRecord);

  console.log(`[iter ${iter}] baseline=$${iterRecord.cost.baseline.toFixed(2)} essence=$${iterRecord.cost.essence.toFixed(2)} patch=$${iterRecord.cost.patch.toFixed(2)}  cumul=$${totalCost.toFixed(2)}`);
}

const summary = {
  model: MODEL, iters: N_ITERS, cumulativeCost: totalCost,
  perIter: iterReports.map((r) => ({ iter: r.iter, cost: r.cost, cumulativeTotalCost: r.cumulativeTotalCost })),
};
writeFileSync(join(OUT_ROOT, 'summary.json'), stableJson(summary));

console.log('\n=== WIKI MINIMAL BENCH SUMMARY ===');
console.log(`iters: ${N_ITERS}  model: ${MODEL}  total: $${totalCost.toFixed(2)}`);

for (const r of REPOS) rmSync(repoState[r.name].tmp, { recursive: true, force: true });
