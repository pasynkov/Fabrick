#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { generatePage, patchPage } from '../src/llm/page-generator.js';
import { judge } from '../src/llm/judge.js';

const repoKey = (process.argv[2] ?? 'backend1').toUpperCase();
const repoPath = process.env[`NAMI_REPO_${repoKey}`] ?? process.env[`FABRICK_REPO_${repoKey}`];
if (!repoPath || !existsSync(repoPath)) {
  console.error(`Repo path missing. Set NAMI_REPO_${repoKey} in .env.local.`);
  process.exit(1);
}

const OUT = join(process.cwd(), '.lab', 'llm-smoke', repoKey.toLowerCase());
mkdirSync(OUT, { recursive: true });

console.log(`[setup] copying ${repoPath} to workspace for safe edits`);
const work = mkdtempSync(join(tmpdir(), 'llm-smoke-'));
cpSync(repoPath, work, { recursive: true, dereference: false, filter: (src) => !src.includes('node_modules') && !src.includes('/dist/') });

console.log('[snapshot] building baseline');
const before = buildSnapshot(work);
console.log(`  symbols=${before.symbols.length} files=${Object.keys(before.files).length}`);

const target = before.symbols.find((s) =>
  s.exported && s.kind === 'class' && !s.name.includes('.') &&
  before.symbols.some((m) => m.name.startsWith(s.name + '.') && m.kind === 'method')
);
if (!target) { console.error('No suitable class found'); process.exit(1); }
console.log(`[target] ${target.id}`);

const targetSymbols = before.symbols.filter(
  (s) => s.file === target.file && (s.name === target.name || s.name.startsWith(target.name + '.')),
);
const slug = `entities/${target.name}.md`;

console.log('[step 1] generate full baseline page (LLM call 1/3)');
const baselinePage = await generatePage({ slug, symbols: targetSymbols, repoRoot: work });
writeFileSync(join(OUT, 'baseline.md'), baselinePage.content);
logCall('baseline-gen', baselinePage);

const filePath = join(work, target.file);
const original = readFileSync(filePath, 'utf8');
const probeMarker = original.lastIndexOf('}');
const synthMethod = `\n  /** Synthetic probe added by llm-smoke. */\n  probeMethodAddedByTest(input: number): number {\n    return input + 1;\n  }\n`;
const mutated = original.slice(0, probeMarker) + synthMethod + original.slice(probeMarker);
writeFileSync(filePath, mutated);
console.log(`[mutate] added probeMethodAddedByTest to ${target.file}`);

const after = buildSnapshot(work);
const diff = diffSnapshots(before, after);
console.log(`[diff] added=${diff.symbols.added.length} bodyChanged=${diff.symbols.bodyChanged.length} sigChanged=${diff.symbols.sigChanged.length}`);

const fakeSourcemap = { pages: { [slug]: { symbols: targetSymbols.map((s) => s.id), files: [target.file] } } };
const inv = invalidate({ diff, sourcemap: fakeSourcemap, currentSymbols: after.symbols });
console.log(`[invalidate] invalidated=${inv.pagesInvalidated.join(', ')}`);

const newSymbols = after.symbols.filter(
  (s) => s.file === target.file && (s.name === target.name || s.name.startsWith(target.name + '.')),
);

const changeDescriptions = (inv.reasons[slug] ?? []).concat(
  diff.symbols.added.filter((s) => s.file === target.file).map((s) => `added:${s.name} (${s.kind})`),
);

console.log('[step 2] patch existing page (full-source) (LLM call 2/3)');
const patched = await patchPage({
  slug, existingPage: baselinePage.content, changes: changeDescriptions,
  symbols: newSymbols, repoRoot: work,
});
writeFileSync(join(OUT, 'incremental.md'), patched.content);
logCall('incr-patch', patched);

console.log('[step 3] regenerate page from scratch (LLM call 3/3)');
const fullRebuild = await generatePage({ slug, symbols: newSymbols, repoRoot: work });
writeFileSync(join(OUT, 'full-rebuild.md'), fullRebuild.content);
logCall('full-rebuild', fullRebuild);

console.log('[step 4] judge equivalence incremental vs full (LLM call 4/4)');
const verdict = await judge({
  pageA: patched.content, pageB: fullRebuild.content,
  context: `Both pages document the class \`${target.name}\` at ${target.file}.`,
});
writeFileSync(join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2));
console.log(`[verdict] equivalent=${verdict.equivalent} score=${verdict.score}`);
console.log(`           differences: ${(verdict.differences ?? []).join('; ')}`);

const totalCost = [baselinePage, patched, fullRebuild, verdict].reduce((s, x) => s + (x.costUsd ?? 0), 0);
const totalIncrCost = (baselinePage.costUsd ?? 0) + (patched.costUsd ?? 0);
const totalFullCost = (baselinePage.costUsd ?? 0) + (fullRebuild.costUsd ?? 0);
console.log('\n=== LLM SMOKE REPORT ===');
console.log(`target:                 ${target.id}`);
console.log(`pages compared:         1 (mutation isolated to single class)`);
console.log(`semantic score:         ${verdict.score} (equivalent=${verdict.equivalent})`);
console.log(`baseline gen cost:      $${(baselinePage.costUsd ?? 0).toFixed(4)}`);
console.log(`incremental patch cost: $${(patched.costUsd ?? 0).toFixed(4)}`);
console.log(`full rebuild cost:      $${(fullRebuild.costUsd ?? 0).toFixed(4)}`);
console.log(`judge cost:             $${(verdict.costUsd ?? 0).toFixed(4)}`);
console.log(`total smoke cost:       $${totalCost.toFixed(4)}`);
console.log(`incr/full cost ratio:   ${((patched.costUsd ?? 0) / (fullRebuild.costUsd ?? 1) * 100).toFixed(1)}%`);
console.log(`outputs:                ${OUT}`);

rmSync(work, { recursive: true, force: true });

function logCall(label, res) {
  console.log(`  [${label}] tokens in=${res.usage?.input_tokens ?? '?'} out=${res.usage?.output_tokens ?? '?'} cost=$${(res.costUsd ?? 0).toFixed(4)} wall=${res.durationMs ?? '?'}ms`);
}
