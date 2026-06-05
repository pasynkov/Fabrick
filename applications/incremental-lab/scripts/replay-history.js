#!/usr/bin/env node
// Walk a repo through a chain of historical SHAs, building the genesis wiki
// at the first SHA and applying incremental patches forward. Snapshot the
// wiki + state into <repo>/.fabrick/history/iter-N/ after each step so we
// can compare quality across iterations afterwards.
//
// Usage:
//   node scripts/replay-history.js <repo> [--steps=2025-09-09,2025-09-15,...] [--max-cost=8]
//
// Default step dates mirror the bench: ~3-week window over Sep–Oct 2025.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { run as runBootstrap } from '../src/cli/bootstrap.js';
import { run as runFullscan } from '../src/cli/fullscan.js';
import { run as runPatch } from '../src/cli/patch.js';
import { fabrickDir, statePath, readState, writeState } from '../src/cli/state.js';
import { stableJson } from '../src/snapshot/store.js';

const DEFAULT_DATES = ['2025-09-09', '2025-09-15', '2025-09-22', '2025-09-28', '2025-10-08', '2025-10-13'];

const argv = process.argv.slice(2);
const repoPath = argv.find((a) => !a.startsWith('--'));
if (!repoPath || !existsSync(repoPath)) {
  console.error('usage: node replay-history.js <repo> [--steps=date1,date2,...] [--max-cost=8] [--skip-bootstrap]');
  process.exit(1);
}
const stepDates = (argv.find((a) => a.startsWith('--steps='))?.split('=')[1] ?? DEFAULT_DATES.join(','))
  .split(',').map((s) => s.trim()).filter(Boolean);
const maxCost = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 8);
const skipBootstrap = argv.includes('--skip-bootstrap');

console.log(`[replay] ${repoPath}`);
console.log(`[replay] steps: ${stepDates.join(', ')}`);

const git = simpleGit(repoPath);

// Resolve each date to the last commit reachable by HEAD on or before that day.
const shas = [];
for (const date of stepDates) {
  const raw = await git.raw(['log', '--all', '--until', `${date}T23:59:59`, '--pretty=%H', '-1']);
  const sha = raw.trim();
  if (!sha) { console.error(`no commit before ${date}`); process.exit(1); }
  shas.push({ date, sha });
}
console.log(`[replay] resolved SHAs:`);
for (const s of shas) console.log(`   ${s.date}  ${s.sha.slice(0, 12)}`);

const fdir = fabrickDir(repoPath);
const historyDir = join(fdir, 'history');
rmSync(historyDir, { recursive: true, force: true });
mkdirSync(historyDir, { recursive: true });

// Snapshot the user's current HEAD so we can restore at the end (best-effort).
const originalHead = (await git.raw(['rev-parse', 'HEAD'])).trim();

let totalCost = 0;
const report = { repoPath, stepDates, shas, iters: [] };

try {
  for (let i = 0; i < shas.length; i++) {
    const { date, sha } = shas[i];
    console.log(`\n=== iter ${i}  ${date}  ${sha.slice(0, 7)} ===`);

    console.log(`[git] checkout ${sha.slice(0, 7)}`);
    await git.raw(['checkout', sha]);

    const iterDir = join(historyDir, `iter-${i}`);
    mkdirSync(iterDir, { recursive: true });

    const t0 = Date.now();
    let iterCost = 0;

    if (i === 0) {
      if (!skipBootstrap) {
        await runBootstrap(repoPath, [`--model=sonnet`]);
        // bootstrap doesn't return cost — read it from state.
        const s = readState(repoPath);
        iterCost += s?.bootstrapCostUsd ?? 0;
      }
      // Fresh fullscan at genesis.
      rmSync(join(fdir, 'wiki'), { recursive: true, force: true });
      await runFullscan(repoPath, ['--model=sonnet', `--max-cost=${(maxCost - totalCost).toFixed(2)}`]);
      const s = readState(repoPath);
      iterCost += s?.lastFullscanCostUsd ?? 0;
    } else {
      await runPatch(repoPath, ['--compute-model=sonnet', '--apply-model=haiku', `--max-cost=${(maxCost - totalCost).toFixed(2)}`]);
      const s = readState(repoPath);
      iterCost += s?.lastPatchCostUsd ?? 0;
    }

    const ms = Date.now() - t0;
    totalCost += iterCost;
    if (totalCost > maxCost) throw new Error(`max-cost $${maxCost} exceeded`);

    // Snapshot wiki + state for this iter.
    cpSync(join(fdir, 'wiki'), join(iterDir, 'wiki'), { recursive: true });
    if (existsSync(statePath(repoPath))) cpSync(statePath(repoPath), join(iterDir, 'state.json'));

    report.iters.push({ iter: i, date, sha, cost: iterCost, ms, mode: i === 0 ? 'genesis' : 'patch' });
    console.log(`[iter ${i}] cost $${iterCost.toFixed(3)} (cumul $${totalCost.toFixed(2)})  ${ms}ms`);
  }
} finally {
  try { await git.raw(['checkout', originalHead]); } catch {}
}

report.totalCostUsd = totalCost;
writeFileSync(join(historyDir, 'report.json'), stableJson(report));

console.log('\n=== REPLAY SUMMARY ===');
console.log(`steps:    ${shas.length}`);
console.log(`total $:  ${totalCost.toFixed(2)}`);
console.log(`history:  ${historyDir}/iter-N/wiki/`);
for (const r of report.iters) console.log(`  iter ${r.iter}  ${r.date}  ${r.mode.padEnd(8)} $${r.cost.toFixed(3)}`);
