#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { structuralEquivalence } from '../src/validate/validate.js';
import { stableJson } from '../src/snapshot/store.js';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const app = positional[0] ?? 'backend';
const N = Number(argv.find((a) => a.startsWith('--commits='))?.split('=')[1] ?? 20);
const repoRoot = resolve(argv.find((a) => a.startsWith('--repo='))?.split('=')[1] ?? '../..');
const subdir = `applications/${app}`;

if (!existsSync(join(repoRoot, '.git'))) {
  console.error(`No .git at ${repoRoot}`); process.exit(1);
}
if (!existsSync(join(repoRoot, subdir))) {
  console.error(`No ${subdir} at ${repoRoot}`); process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'fabrick-drift-'));
console.log(`[clone] ${repoRoot} → ${tmp}`);
const sourceGit = simpleGit(repoRoot);
await sourceGit.clone(repoRoot, tmp, ['--no-local']).catch(async () => {
  await sourceGit.clone(repoRoot, tmp);
});
const git = simpleGit(tmp);
const subPath = join(tmp, subdir);

const log = await git.log({ maxCount: N + 1, file: subdir });
if (log.all.length < 2) {
  console.error(`Not enough history touching ${subdir} (found ${log.all.length}).`); process.exit(1);
}
const commits = log.all.map((c) => c.hash).reverse();
console.log(`[history] ${commits.length} commits touching ${subdir}, oldest ${commits[0].slice(0, 7)} → newest ${commits.at(-1).slice(0, 7)}`);

await git.checkout(commits[0]);
let snap = buildSnapshot(subPath);
let smap = synthSourcemap(snap);
const initialPages = Object.keys(smap.pages).length;
console.log(`[baseline] files=${Object.keys(snap.files).length} symbols=${snap.symbols.length} pages=${initialPages}`);

if (Object.keys(snap.files).length === 0) {
  console.error(`No supported source files at baseline; aborting.`);
  rmSync(tmp, { recursive: true, force: true }); process.exit(1);
}

let totalPagesTouched = 0;
let stepCount = 0;
const stepLog = [];
let extractErrors = 0;

for (let i = 1; i < commits.length; i++) {
  const sha = commits[i];
  await git.checkout(sha);
  const before = snap;
  const after = buildSnapshot(subPath);
  for (const f of Object.values(after.files)) if (f.extractError) extractErrors++;
  const diff = diffSnapshots(before, after);
  const inv = invalidate({ diff, sourcemap: smap, currentSymbols: after.symbols });
  smap = applyInvalidation({ sourcemap: smap, invalidation: inv, newSnapshot: after });
  snap = after;
  const touched = inv.pagesInvalidated.length + inv.pagesDeleted.length + inv.newSymbols.length;
  totalPagesTouched += touched;
  stepCount++;
  stepLog.push({ sha: sha.slice(0, 7), touched, invalidated: inv.pagesInvalidated.length, deleted: inv.pagesDeleted.length, newSymbols: inv.newSymbols.length });
  console.log(`[step ${String(i).padStart(2)}/${commits.length - 1}] ${sha.slice(0, 7)} touched=${String(touched).padStart(3)} (inv=${inv.pagesInvalidated.length} del=${inv.pagesDeleted.length} new=${inv.newSymbols.length})`);
}

await git.checkout(commits.at(-1));
const finalSnap = buildSnapshot(subPath);
const fullSmap = synthSourcemap(finalSnap);
const fullRebuildCost = Object.keys(fullSmap.pages).length;
const equiv = structuralEquivalence(smap, fullSmap);

const report = {
  app, subdir, repoRoot,
  commits: commits.length,
  initialPages,
  finalPagesIncr: Object.keys(smap.pages).length,
  finalPagesFull: Object.keys(fullSmap.pages).length,
  costRatio: stepCount > 0 && fullRebuildCost > 0 ? totalPagesTouched / (fullRebuildCost * stepCount) : 0,
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
  extractErrors,
  steps: stepLog,
};

const outDir = join(process.cwd(), '.lab', 'drift', `fabrick-${app}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), stableJson(report));

console.log('\n=== DRIFT REPORT ===');
console.log(`app:            ${app}`);
console.log(`commits:        ${commits.length}`);
console.log(`pages full:     ${report.finalPagesFull}`);
console.log(`pages incr:     ${report.finalPagesIncr}`);
console.log(`cost ratio:     ${(report.costRatio * 100).toFixed(2)}%`);
console.log(`drift:          ${(report.drift * 100).toFixed(2)}%`);
console.log(`drift breakdown: only-in-incr=${report.driftBreakdown.onlyInIncr} only-in-full=${report.driftBreakdown.onlyInFull} symbolsDiffer=${report.driftBreakdown.symbolsDiffer} filesDiffer=${report.driftBreakdown.filesDiffer}`);
console.log(`extract errors: ${extractErrors}`);
console.log(`report:         ${join(outDir, 'report.json')}`);

rmSync(tmp, { recursive: true, force: true });
