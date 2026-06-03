#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { structuralEquivalence } from '../src/validate/validate.js';
import { stableJson } from '../src/snapshot/store.js';

const argv = process.argv.slice(2);
const repoKey = (argv.find((a) => !a.startsWith('--')) ?? 'backend1').toUpperCase();
const N = Number(argv.find((a) => a.startsWith('--commits='))?.split('=')[1] ?? 20);
const repoPath = process.env[`NAMI_REPO_${repoKey}`];

if (!repoPath || !existsSync(repoPath)) {
  console.error(`NAMI_REPO_${repoKey} not set or path missing.`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'nami-drift-'));
console.log(`[clone] ${basename(repoPath)} → ${tmp}`);
const sourceGit = simpleGit(repoPath);
await sourceGit.clone(repoPath, tmp, ['--no-local']).catch(async () => {
  await sourceGit.clone(repoPath, tmp);
});
const git = simpleGit(tmp);

const log = await git.log({ maxCount: N + 1 });
const commits = log.all.map((c) => c.hash).reverse();
console.log(`[history] ${commits.length} commits, oldest ${commits[0].slice(0, 7)} → newest ${commits.at(-1).slice(0, 7)}`);

await git.checkout(commits[0]);
let snap = buildSnapshot(tmp);
let smap = synthSourcemap(snap);
const initialPages = Object.keys(smap.pages).length;
console.log(`[baseline] files=${Object.keys(snap.files).length} symbols=${snap.symbols.length} pages=${initialPages}`);

let totalPagesTouched = 0;
let stepCount = 0;
const stepLog = [];

for (let i = 1; i < commits.length; i++) {
  const sha = commits[i];
  await git.checkout(sha);
  const before = snap;
  const after = buildSnapshot(tmp);
  const diff = diffSnapshots(before, after);
  const inv = invalidate({ diff, sourcemap: smap, currentSymbols: after.symbols });
  smap = applyInvalidation({ sourcemap: smap, invalidation: inv, newSnapshot: after });
  snap = after;
  const touched = inv.pagesInvalidated.length + inv.pagesDeleted.length + inv.newSymbols.length;
  totalPagesTouched += touched;
  stepCount++;
  stepLog.push({ sha: sha.slice(0, 7), touched, invalidated: inv.pagesInvalidated.length, deleted: inv.pagesDeleted.length, newSymbols: inv.newSymbols.length });
  console.log(`[step ${String(i).padStart(2)}/${commits.length - 1}] ${sha.slice(0, 7)} touched=${touched.toString().padStart(3)} (inv=${inv.pagesInvalidated.length} del=${inv.pagesDeleted.length} new=${inv.newSymbols.length})`);
}

await git.checkout(commits.at(-1));
const finalSnap = buildSnapshot(tmp);
const fullSmap = synthSourcemap(finalSnap);
const fullRebuildCost = Object.keys(fullSmap.pages).length;

const equiv = structuralEquivalence(smap, fullSmap);
const report = {
  repo: repoKey,
  commits: commits.length,
  initialPages,
  finalPagesIncr: Object.keys(smap.pages).length,
  finalPagesFull: Object.keys(fullSmap.pages).length,
  costRatio: stepCount > 0 ? totalPagesTouched / (fullRebuildCost * stepCount) : 0,
  drift: equiv.drift,
  driftBreakdown: {
    onlyInIncr: equiv.onlyInA.length,
    onlyInFull: equiv.onlyInB.length,
    symbolsDiffer: equiv.symbolsDiffer.length,
    filesDiffer: equiv.filesDiffer.length,
  },
  driftDetails: {
    onlyInIncr: equiv.onlyInA.slice(0, 20),
    onlyInFull: equiv.onlyInB.slice(0, 20),
    symbolsDiffer: equiv.symbolsDiffer.slice(0, 20),
    filesDiffer: equiv.filesDiffer.slice(0, 20),
  },
  steps: stepLog,
};

const outDir = join(process.cwd(), '.lab', 'drift', repoKey.toLowerCase());
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), stableJson(report));

console.log('\n=== DRIFT REPORT ===');
console.log(`repo:           ${repoKey}`);
console.log(`commits:        ${commits.length}`);
console.log(`pages full:     ${report.finalPagesFull}`);
console.log(`pages incr:     ${report.finalPagesIncr}`);
console.log(`cost ratio:     ${(report.costRatio * 100).toFixed(2)}%   (incr touched / full×steps)`);
console.log(`drift:          ${(report.drift * 100).toFixed(2)}%`);
console.log(`drift breakdown: only-in-incr=${report.driftBreakdown.onlyInIncr} only-in-full=${report.driftBreakdown.onlyInFull} symbolsDiffer=${report.driftBreakdown.symbolsDiffer} filesDiffer=${report.driftBreakdown.filesDiffer}`);
console.log(`report:         ${join(outDir, 'report.json')}`);

rmSync(tmp, { recursive: true, force: true });
