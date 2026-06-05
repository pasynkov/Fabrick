#!/usr/bin/env node
// Bootstrap project-specific routing rules from a tree-sitter snapshot.
//
// Usage:
//   node scripts/bootstrap-rules.js <repo-path> [--model=sonnet]
//
// Reads <repo>/.fabrick/investigate/{summary.json, sample-symbols.json}
// (run scripts/investigate-snapshot.js first).
//
// Writes <repo>/.fabrick/routing-rules.json + raw LLM trace.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { callClaude } from '../src/llm/cli.js';
import { bootstrapRoutingRulesPrompt } from '../src/llm/bootstrap-prompts.js';
import { stableJson } from '../src/snapshot/store.js';
import { buildFileSlugMap, invertSlugMap } from '../src/wiki/router.js';

const argv = process.argv.slice(2);
const repoPath = argv.find((a) => !a.startsWith('--'));
const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';

if (!repoPath || !existsSync(repoPath)) {
  console.error('usage: node bootstrap-rules.js <repo-path> [--model=sonnet]');
  process.exit(1);
}

const invDir = join(repoPath, '.fabrick', 'investigate');
const summaryPath = join(invDir, 'summary.json');
const samplePath = join(invDir, 'sample-symbols.json');
if (!existsSync(summaryPath) || !existsSync(samplePath)) {
  console.error(`missing snapshot artifacts. run: node scripts/investigate-snapshot.js ${repoPath}`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const sampleSymbols = JSON.parse(readFileSync(samplePath, 'utf8'));
const rootFilesPath = join(invDir, 'root-files.json');
const rootFiles = existsSync(rootFilesPath) ? JSON.parse(readFileSync(rootFilesPath, 'utf8')) : {};
const repoName = basename(repoPath);

const built = bootstrapRoutingRulesPrompt({ repoName, summary, sampleSymbols, rootFiles });

const traceDir = join(repoPath, '.fabrick');
mkdirSync(traceDir, { recursive: true });
writeFileSync(join(traceDir, 'bootstrap.prompt.txt'), `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`);

console.log(`[bootstrap] ${repoName} via ${MODEL}`);
const t0 = Date.now();
const res = await callClaude(built, { model: MODEL, timeoutMs: 600_000 });
const ms = Date.now() - t0;
console.log(`[done] ${ms}ms, cost: $${(res.costUsd ?? 0).toFixed(4)}`);

writeFileSync(join(traceDir, 'bootstrap.response.md'), res.content);

let rules;
try {
  const text = res.content;
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object found in response');
  let body = text.slice(start);
  // Strip code fences if model wrapped output despite instruction.
  body = body.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  try {
    rules = JSON.parse(body);
  } catch {
    // Tolerate truncated tail: try closing the object.
    const lastBrace = body.lastIndexOf('}');
    const truncated = lastBrace > 0 ? body.slice(0, lastBrace + 1) : body + '}';
    rules = JSON.parse(truncated);
  }
} catch (e) {
  console.error('failed to parse rules JSON:', e.message);
  console.error('raw response saved to .fabrick/bootstrap.response.md');
  process.exit(1);
}

const rulesPath = join(traceDir, 'routing-rules.json');
writeFileSync(rulesPath, stableJson(rules));
console.log(`[wrote] ${rulesPath}`);

// Apply rules to snapshot → concrete file-slug map (deterministic, no LLM).
const snapshotPath = join(invDir, 'snapshot.json');
if (existsSync(snapshotPath)) {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const fileSlug = buildFileSlugMap(snapshot, rules);
  const slugFiles = invertSlugMap(fileSlug);
  const mapPath = join(traceDir, 'file-slug-map.json');
  writeFileSync(mapPath, stableJson({ files: fileSlug, bySlug: slugFiles }));
  console.log(`[wrote] ${mapPath}`);

  const totals = {};
  let unmapped = 0;
  for (const entry of Object.values(fileSlug)) {
    if (entry.slugs.length === 0) unmapped += 1;
    for (const slug of entry.slugs) totals[slug] = (totals[slug] ?? 0) + 1;
  }
  console.log(`\n=== FILE→SLUG ===`);
  for (const slug of ['service', 'contracts', 'config', 'integrations']) {
    console.log(`  ${slug.padEnd(13)} ${(totals[slug] ?? 0).toString().padStart(4)} files`);
  }
  console.log(`  unmapped     ${unmapped.toString().padStart(4)} files (no rule matched)`);
}

console.log('\n=== SUMMARY ===');
if (rules.project) {
  console.log(`project:       ${rules.project.kind ?? '?'} | ${rules.project.language ?? '?'} | ${rules.project.framework ?? '?'}`);
  if (rules.project.apps?.length) console.log(`apps:          ${rules.project.apps.length} (${rules.project.apps.slice(0, 4).map((a) => a.name).join(', ')}${rules.project.apps.length > 4 ? ', …' : ''})`);
  if (rules.project.runCommands?.length) console.log(`run:           ${rules.project.runCommands.slice(0, 3).join(' | ')}`);
  if (rules.project.summary) console.log(`summary:       ${rules.project.summary}`);
}
console.log(`frameworks:    ${(rules.frameworks ?? []).join(', ') || '(none)'}`);
console.log(`internalLibs:  ${(rules.internalLibs ?? []).length}`);
console.log(`decorators:`);
for (const [cat, list] of Object.entries(rules.decorators ?? {})) {
  console.log(`  ${cat.padEnd(10)} ${list.length}: ${list.slice(0, 8).join(', ')}${list.length > 8 ? ', …' : ''}`);
}
console.log(`integrations:  ${Object.keys(rules.imports?.integrations ?? {}).length} packages`);
console.log(`file patterns: ${Object.keys(rules.filePatterns ?? {}).length}`);
if (rules.notes) console.log(`notes: ${rules.notes}`);
