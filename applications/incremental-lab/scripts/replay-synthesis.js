#!/usr/bin/env node
// Replay synthesis over a chain of wiki history snapshots produced by
// scripts/replay-history.js. For each iter:
//   1. Restore each repo's wiki/ from .fabrick/history/iter-N/wiki
//   2. Run fabrick synthesize (genesis on iter 0, patch thereafter)
//   3. Snapshot the resulting synthesis pages to <out>/history/iter-N/
//
// Usage:
//   node scripts/replay-synthesis.js <out-dir> --repos=r1,r2 [--system=name] [--iters=0,1,2,3,4,5]

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { run as runSynthesize } from '../src/cli/synthesize.js';
import { wikiDir, fabrickDir } from '../src/cli/state.js';
import { stableJson } from '../src/snapshot/store.js';

const argv = process.argv.slice(2);
const outDir = argv.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error('usage: node replay-synthesis.js <out-dir> --repos=r1,r2 [--iters=0,1,2,3,4,5] [--system=name] [--max-cost=10]');
  process.exit(1);
}
const repoPaths = (argv.find((a) => a.startsWith('--repos='))?.split('=')[1] ?? '').split(',').filter(Boolean);
if (repoPaths.length < 2) { console.error('--repos must list ≥2 paths'); process.exit(1); }
const itersArg = argv.find((a) => a.startsWith('--iters='))?.split('=')[1];
const iters = itersArg ? itersArg.split(',').map(Number) : [0, 1, 2, 3, 4, 5];
const systemName = argv.find((a) => a.startsWith('--system='))?.split('=')[1] ?? basename(outDir);
const maxCost = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 10);

// Verify history exists for each repo.
for (const p of repoPaths) {
  for (const i of iters) {
    const dir = join(fabrickDir(p), 'history', `iter-${i}`, 'wiki');
    if (!existsSync(dir)) { console.error(`missing history: ${dir}`); process.exit(1); }
  }
}

mkdirSync(outDir, { recursive: true });
const historyDir = join(outDir, 'history');
rmSync(historyDir, { recursive: true, force: true });
mkdirSync(historyDir, { recursive: true });

// Wipe any prior synthesis state so iter 0 is a real genesis.
for (const f of ['system.md', 'data-flows.md', 'transport-graph.md', 'infra.md', '_baseline-wiki', '_meta.json']) {
  rmSync(join(outDir, f), { recursive: true, force: true });
}

const report = { systemName, iters: [] };
let totalCost = 0;

console.log(`[replay-synth] ${systemName}, ${repoPaths.length} repos, iters ${iters.join(',')}`);

// Save current wiki for each repo so we can restore at the end (best-effort).
const wikiBackup = {};
for (const p of repoPaths) {
  const cur = wikiDir(p);
  if (existsSync(cur)) {
    const bak = join('/tmp', `wiki-backup-${basename(p)}-${Date.now()}`);
    cpSync(cur, bak, { recursive: true });
    wikiBackup[p] = bak;
  }
}

try {
  for (const i of iters) {
    console.log(`\n=== iter ${i} ===`);
    // Restore each repo's wiki from its iter-N snapshot.
    for (const p of repoPaths) {
      const src = join(fabrickDir(p), 'history', `iter-${i}`, 'wiki');
      const dst = wikiDir(p);
      rmSync(dst, { recursive: true, force: true });
      cpSync(src, dst, { recursive: true });
    }

    const t0 = Date.now();
    const cliArgs = ['--repos=' + repoPaths.join(','), `--system=${systemName}`, `--max-cost=${(maxCost - totalCost).toFixed(2)}`];
    if (i === iters[0]) cliArgs.push('--rebuild');
    await runSynthesize(outDir, cliArgs);
    const ms = Date.now() - t0;

    // Read cost from _meta.json
    let iterCost = 0;
    try {
      const meta = JSON.parse(readFileSync(join(outDir, '_meta.json'), 'utf8'));
      iterCost = meta.costUsd ?? 0;
    } catch {}
    totalCost += iterCost;

    // Snapshot synthesis pages.
    const iterDir = join(historyDir, `iter-${i}`);
    mkdirSync(iterDir, { recursive: true });
    for (const f of ['system.md', 'data-flows.md', 'transport-graph.md', 'infra.md', '_meta.json', '_patch.md']) {
      const src = join(outDir, f);
      if (existsSync(src)) cpSync(src, join(iterDir, f));
    }

    report.iters.push({ iter: i, cost: iterCost, ms });
    console.log(`[iter ${i}] $${iterCost.toFixed(3)} (cumul $${totalCost.toFixed(2)})  ${ms}ms`);
  }
} finally {
  // Restore wikis.
  for (const [p, bak] of Object.entries(wikiBackup)) {
    rmSync(wikiDir(p), { recursive: true, force: true });
    cpSync(bak, wikiDir(p), { recursive: true });
    rmSync(bak, { recursive: true, force: true });
  }
}

report.totalCostUsd = totalCost;
writeFileSync(join(historyDir, 'report.json'), stableJson(report));

console.log('\n=== REPLAY-SYNTH SUMMARY ===');
console.log(`iters: ${iters.length}`);
console.log(`total: $${totalCost.toFixed(2)}`);
for (const r of report.iters) console.log(`  iter ${r.iter}  $${r.cost.toFixed(3)}`);
