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

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// Capture top-level project metadata: directories + key root files (project
// manifests, READMEs, build configs, Dockerfiles). Used by the bootstrap LLM
// to identify language, framework, monorepo layout, run commands.
const ROOT_FILE_MAX_BYTES = 8000;
const ROOT_FILE_TOTAL_CAP = 60000;
const ROOT_FILE_PATTERNS = [
  /^README(\..+)?$/i,
  /^CHANGELOG(\..+)?$/i,
  /^LICENSE(\..+)?$/i,
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^lerna\.json$/,
  /^turbo\.json$/,
  /^nx\.json$/,
  /^nest-cli\.json$/,
  /^tsconfig.*\.json$/,
  /^jsconfig\.json$/,
  /^pyproject\.toml$/,
  /^setup\.py$/,
  /^setup\.cfg$/,
  /^requirements.*\.txt$/i,
  /^Pipfile$/,
  /^go\.mod$/,
  /^go\.sum$/,
  /^Cargo\.toml$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^settings\.gradle(\.kts)?$/,
  /^composer\.json$/,
  /^Gemfile$/,
  /^Makefile$/,
  /^Justfile$/,
  /^Dockerfile(\..+)?$/,
  /^docker-compose.*\.ya?ml$/,
  /^kustomization\.ya?ml$/,
  /^skaffold\.ya?ml$/,
  /^helmfile.*$/,
  /^webpack\.config\..+$/,
  /^vite\.config\..+$/,
  /^rollup\.config\..+$/,
  /^\.nvmrc$/,
  /^\.python-version$/,
  /^\.ruby-version$/,
  /^\.tool-versions$/,
  /^build\.sh$/,
];
const ROOT_FILE_SKIP = /^(\.env|.*-lock\.(json|yaml|yml)|.*\.lock|.*\.pem|.*\.key|\.DS_Store|node_modules)$/;

function readRootFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = {};
  const dirs = [];
  let total = 0;
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory()) {
      if (!e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'build') {
        dirs.push(e.name);
      }
      continue;
    }
    if (!e.isFile()) continue;
    if (ROOT_FILE_SKIP.test(e.name)) continue;
    if (!ROOT_FILE_PATTERNS.some((re) => re.test(e.name))) continue;
    const abs = join(root, e.name);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.size > ROOT_FILE_MAX_BYTES * 4) continue;
    let content;
    try { content = readFileSync(abs, 'utf8'); } catch { continue; }
    if (content.length > ROOT_FILE_MAX_BYTES) content = content.slice(0, ROOT_FILE_MAX_BYTES) + '\n... (truncated)';
    if (total + content.length > ROOT_FILE_TOTAL_CAP) break;
    files[e.name] = content;
    total += content.length;
  }
  return { rootFiles: files, topLevelDirs: dirs };
}

const { rootFiles, topLevelDirs } = readRootFiles(repoPath);
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
  topLevelDirs,
  rootFileNames: Object.keys(rootFiles),
}));

writeFileSync(join(outDir, 'root-files.json'), stableJson(rootFiles));

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
