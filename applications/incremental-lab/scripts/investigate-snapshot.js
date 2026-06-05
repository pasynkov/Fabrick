#!/usr/bin/env node
// Dump full tree-sitter snapshot of a repo to <repo>/.fabrick/investigate/.
//
// Usage:
//   node scripts/investigate-snapshot.js <repo-path>
//
// Emits:
//   snapshot.json           full {files, symbols} dump
//   summary.json            high-level counts
//   by-kind/<kind>.txt      symbols grouped by kind
//   by-file.txt             per-file symbol counts (sorted desc)
//   decorators.txt          all decorators seen (frequency)
//   imports.txt             all unique imports seen (frequency)
//   skipped.txt             files that failed to parse
//   sample-symbols.json     20 random symbols, full shape

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { stableJson } from '../src/snapshot/store.js';

const repoPath = process.argv[2];
if (!repoPath || !existsSync(repoPath)) {
  console.error('usage: node investigate-snapshot.js <repo-path>');
  process.exit(1);
}

const outDir = join(repoPath, '.fabrick', 'investigate');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log(`[scan] ${repoPath}`);
const t0 = Date.now();
const snap = buildSnapshot(repoPath);
const ms = Date.now() - t0;
console.log(`[done] ${snap.symbols.length} symbols across ${Object.keys(snap.files).length} files in ${ms}ms`);

writeFileSync(join(outDir, 'snapshot.json'), stableJson(snap));

// Group by kind
const byKind = {};
for (const s of snap.symbols) (byKind[s.kind] ??= []).push(s);

const kindCounts = Object.fromEntries(
  Object.entries(byKind).map(([k, arr]) => [k, arr.length]).sort((a, b) => b[1] - a[1])
);

// Per-file counts
const byFile = {};
for (const s of snap.symbols) byFile[s.file] = (byFile[s.file] ?? 0) + 1;

// Decorator frequency (extract @Name from signature heads)
const decoratorFreq = {};
const decoratorRe = /@([A-Z]\w*)/g;
for (const s of snap.symbols) {
  let m;
  while ((m = decoratorRe.exec(s.signature ?? '')) !== null) {
    decoratorFreq[m[1]] = (decoratorFreq[m[1]] ?? 0) + 1;
  }
}

// Decorator usage matrix: for each decorator, where (file pattern) and with what imports.
// Helps the bootstrap LLM judge whether a decorator is a strong, file-pattern-correlated
// signal (e.g. @Entity always in *.entity.ts) or a generic helper used across contexts.
function filePattern(file) {
  const base = file.split('/').pop() ?? file;
  const m = base.match(/(\.[a-z0-9]+\.[a-z]+)$/i);
  if (m) return `*${m[1]}`;
  const ext = base.match(/(\.[a-z0-9]+)$/i);
  return ext ? `*${ext[1]}` : base;
}
const decoratorMatrix = {};
for (const s of snap.symbols) {
  let m2;
  const seen = new Set();
  while ((m2 = decoratorRe.exec(s.signature ?? '')) !== null) {
    const name = m2[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const slot = (decoratorMatrix[name] ??= { count: 0, filePatterns: {}, coImports: {} });
    slot.count += 1;
    const pat = filePattern(s.file);
    slot.filePatterns[pat] = (slot.filePatterns[pat] ?? 0) + 1;
    for (const imp of s.imports ?? []) slot.coImports[imp] = (slot.coImports[imp] ?? 0) + 1;
  }
}
// Compress matrix: keep only top correlations
const decoratorMatrixCompact = {};
for (const [name, slot] of Object.entries(decoratorMatrix)) {
  if (slot.count < 2) continue; // ignore one-off uses
  decoratorMatrixCompact[name] = {
    count: slot.count,
    filePatterns: Object.entries(slot.filePatterns).sort((a, b) => b[1] - a[1]).slice(0, 5),
    coImports: Object.entries(slot.coImports).sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

// Import frequency
const importFreq = {};
for (const s of snap.symbols) {
  for (const imp of s.imports ?? []) importFreq[imp] = (importFreq[imp] ?? 0) + 1;
}

// Skipped files (extractError present)
const skipped = Object.entries(snap.files)
  .filter(([, v]) => v.extractError)
  .map(([f, v]) => `${f}\t${v.extractError}`);

writeFileSync(join(outDir, 'summary.json'), stableJson({
  repoPath,
  scanMs: ms,
  fileCount: Object.keys(snap.files).length,
  symbolCount: snap.symbols.length,
  kindCounts,
  skippedFiles: skipped.length,
  topDecorators: Object.entries(decoratorFreq).sort((a, b) => b[1] - a[1]).slice(0, 40),
  topImports: Object.entries(importFreq).sort((a, b) => b[1] - a[1]).slice(0, 30),
  topFiles: Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 30),
  decoratorMatrix: decoratorMatrixCompact,
}));

const byKindDir = join(outDir, 'by-kind');
mkdirSync(byKindDir, { recursive: true });
for (const [kind, arr] of Object.entries(byKind)) {
  const lines = arr.slice(0, 200).map((s) =>
    `[${s.file}:${s.location?.row ?? '?'}] ${s.name}  →  ${trim(s.signature ?? '', 200)}`
  );
  if (arr.length > 200) lines.push(`... (${arr.length - 200} more)`);
  writeFileSync(join(byKindDir, `${kind}.txt`), lines.join('\n') + '\n');
}

writeFileSync(join(outDir, 'by-file.txt'),
  Object.entries(byFile).sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `${String(n).padStart(5)}  ${f}`).join('\n') + '\n');

writeFileSync(join(outDir, 'decorators.txt'),
  Object.entries(decoratorFreq).sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${String(n).padStart(5)}  @${d}`).join('\n') + '\n');

writeFileSync(join(outDir, 'imports.txt'),
  Object.entries(importFreq).sort((a, b) => b[1] - a[1])
    .map(([i, n]) => `${String(n).padStart(5)}  ${i}`).join('\n') + '\n');

writeFileSync(join(outDir, 'skipped.txt'), skipped.join('\n') + '\n');

const sample = shuffle(snap.symbols.slice()).slice(0, 20);
writeFileSync(join(outDir, 'sample-symbols.json'), stableJson(sample));

console.log(`[wrote] ${outDir}`);

function trim(s, n) { return s.length > n ? s.slice(0, n - 3) + '...' : s; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
