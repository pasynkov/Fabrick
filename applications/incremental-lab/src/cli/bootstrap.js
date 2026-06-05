// fabrick bootstrap <repo>
//
// 1. copy the bootstrap-routing skill into <repo>/.fabrick/skills/
// 2. run tree-sitter snapshot on the repo (capture decorator matrix, root files, samples)
// 3. invoke claude with the skill -> routing-rules.json
// 4. apply rules deterministically -> file-slug-map.json
// 5. write state.json

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
import { buildSnapshot } from '../snapshot/snapshot.js';
import { stableJson } from '../snapshot/store.js';
import { callClaude } from '../llm/cli.js';
import { bootstrapRoutingRulesPrompt } from '../llm/bootstrap-prompts.js';
import { buildFileSlugMap, invertSlugMap } from '../wiki/router.js';
import { fabrickDir, rulesPath, fileSlugMapPath, writeState, statePath } from './state.js';

const SELF_ROOT = dirname(dirname(dirname(toPath(import.meta.url))));
const SKILL_SRC = join(SELF_ROOT, 'skills', 'bootstrap-routing');

const ROOT_FILE_MAX_BYTES = 8000;
const ROOT_FILE_TOTAL_CAP = 60000;
const ROOT_FILE_PATTERNS = [
  /^README(\..+)?$/i, /^CHANGELOG(\..+)?$/i, /^LICENSE(\..+)?$/i,
  /^package\.json$/, /^pnpm-workspace\.yaml$/, /^lerna\.json$/, /^turbo\.json$/, /^nx\.json$/, /^nest-cli\.json$/,
  /^tsconfig.*\.json$/, /^jsconfig\.json$/,
  /^pyproject\.toml$/, /^setup\.py$/, /^setup\.cfg$/, /^requirements.*\.txt$/i, /^Pipfile$/,
  /^go\.mod$/, /^Cargo\.toml$/, /^pom\.xml$/, /^build\.gradle(\.kts)?$/, /^settings\.gradle(\.kts)?$/,
  /^composer\.json$/, /^Gemfile$/,
  /^Makefile$/, /^Justfile$/, /^Dockerfile(\..+)?$/, /^docker-compose.*\.ya?ml$/,
  /^kustomization\.ya?ml$/, /^skaffold\.ya?ml$/, /^helmfile.*$/,
  /^webpack\.config\..+$/, /^vite\.config\..+$/, /^rollup\.config\..+$/,
  /^\.nvmrc$/, /^\.python-version$/, /^\.ruby-version$/, /^\.tool-versions$/, /^build\.sh$/,
];
const ROOT_FILE_SKIP = /^(\.env|.*-lock\.(json|yaml|yml)|.*\.lock|.*\.pem|.*\.key|\.DS_Store|node_modules)$/;

export async function run(repoPath, argv = []) {
  if (!repoPath || !existsSync(repoPath)) {
    console.error('usage: fabrick bootstrap <repo-path> [--model=sonnet]');
    process.exit(1);
  }
  const model = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';

  const fdir = fabrickDir(repoPath);
  mkdirSync(fdir, { recursive: true });

  // 1. Copy skill into target repo (self-contained future re-runs)
  const skillDst = join(fdir, 'skills', 'bootstrap-routing');
  rmSync(skillDst, { recursive: true, force: true });
  cpSync(SKILL_SRC, skillDst, { recursive: true });
  console.log(`[skill] installed -> ${skillDst}`);

  // 2. Tree-sitter snapshot + root files
  console.log(`[scan] ${repoPath}`);
  const t0 = Date.now();
  const snap = buildSnapshot(repoPath);
  console.log(`[scan] ${snap.symbols.length} symbols / ${Object.keys(snap.files).length} files in ${Date.now() - t0}ms`);

  const { rootFiles, summary, sampleSymbols } = buildBootstrapInput(repoPath, snap);
  const invDir = join(fdir, 'investigate');
  mkdirSync(invDir, { recursive: true });
  writeFileSync(join(invDir, 'snapshot.json'), stableJson(snap));
  writeFileSync(join(invDir, 'summary.json'), stableJson(summary));
  writeFileSync(join(invDir, 'sample-symbols.json'), stableJson(sampleSymbols));
  writeFileSync(join(invDir, 'root-files.json'), stableJson(rootFiles));

  // 3. Bootstrap call
  const skill = loadSkillFromInstall(skillDst);
  const built = bootstrapRoutingRulesPrompt({
    repoName: basename(repoPath),
    summary, sampleSymbols, rootFiles, skill,
  });
  writeFileSync(join(fdir, 'bootstrap.prompt.txt'), `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`);

  console.log(`[bootstrap] calling ${model}…`);
  const t1 = Date.now();
  const res = await callClaude(built, { model, timeoutMs: 600_000 });
  console.log(`[bootstrap] ${Date.now() - t1}ms, cost $${(res.costUsd ?? 0).toFixed(4)}`);
  writeFileSync(join(fdir, 'bootstrap.response.md'), res.content);

  const rules = parseRulesJson(res.content);
  if (!rules) {
    console.error('failed to parse rules JSON (see .fabrick/bootstrap.response.md)');
    process.exit(1);
  }
  writeFileSync(rulesPath(repoPath), stableJson(rules));
  console.log(`[wrote] ${rulesPath(repoPath)}`);

  // 4. Apply rules
  const fileSlug = buildFileSlugMap(snap, rules);
  const bySlug = invertSlugMap(fileSlug);
  writeFileSync(fileSlugMapPath(repoPath), stableJson({ files: fileSlug, bySlug }));
  console.log(`[wrote] ${fileSlugMapPath(repoPath)}`);

  // 5. Initial state (no wiki yet)
  writeState(repoPath, {
    version: 1,
    bootstrappedAt: new Date().toISOString(),
    bootstrapCostUsd: res.costUsd ?? 0,
    project: rules.project ?? null,
    baselineSha: null,
    scopes: {},
  });

  printSummary(rules, fileSlug);
}

function buildBootstrapInput(repoPath, snap) {
  const rootFiles = readRootFiles(repoPath);
  const byFile = {};
  for (const s of snap.symbols) byFile[s.file] = (byFile[s.file] ?? 0) + 1;
  const decoratorFreq = {};
  const decoratorRe = /@([A-Z]\w*)/g;
  const decoratorMatrix = {};
  for (const s of snap.symbols) {
    let m; decoratorRe.lastIndex = 0;
    const seen = new Set();
    while ((m = decoratorRe.exec(s.signature ?? '')) !== null) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      decoratorFreq[name] = (decoratorFreq[name] ?? 0) + 1;
      const slot = (decoratorMatrix[name] ??= { count: 0, filePatterns: {}, coImports: {} });
      slot.count += 1;
      const pat = filePattern(s.file);
      slot.filePatterns[pat] = (slot.filePatterns[pat] ?? 0) + 1;
      for (const imp of s.imports ?? []) slot.coImports[imp] = (slot.coImports[imp] ?? 0) + 1;
    }
  }
  const decoratorMatrixCompact = {};
  for (const [name, slot] of Object.entries(decoratorMatrix)) {
    if (slot.count < 2) continue;
    decoratorMatrixCompact[name] = {
      count: slot.count,
      filePatterns: Object.entries(slot.filePatterns).sort((a, b) => b[1] - a[1]).slice(0, 5),
      coImports: Object.entries(slot.coImports).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }
  const importFreq = {};
  for (const s of snap.symbols) for (const imp of s.imports ?? []) importFreq[imp] = (importFreq[imp] ?? 0) + 1;
  const kindCounts = {};
  for (const s of snap.symbols) kindCounts[s.kind] = (kindCounts[s.kind] ?? 0) + 1;

  const summary = {
    repoPath, fileCount: Object.keys(snap.files).length, symbolCount: snap.symbols.length,
    kindCounts,
    topDecorators: Object.entries(decoratorFreq).sort((a, b) => b[1] - a[1]).slice(0, 40),
    topImports: Object.entries(importFreq).sort((a, b) => b[1] - a[1]).slice(0, 30),
    topFiles: Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 30),
    decoratorMatrix: decoratorMatrixCompact,
    topLevelDirs: readdirSync(repoPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !['node_modules','dist','build'].includes(e.name))
      .map((e) => e.name).sort(),
    rootFileNames: Object.keys(rootFiles),
  };

  const sample = shuffle(snap.symbols.slice()).slice(0, 20);
  return { rootFiles, summary, sampleSymbols: sample };
}

function readRootFiles(root) {
  const out = {};
  let total = 0;
  for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isFile()) continue;
    if (ROOT_FILE_SKIP.test(e.name)) continue;
    if (!ROOT_FILE_PATTERNS.some((re) => re.test(e.name))) continue;
    const abs = join(root, e.name);
    let content;
    try { content = readFileSync(abs, 'utf8'); } catch { continue; }
    if (content.length > ROOT_FILE_MAX_BYTES) content = content.slice(0, ROOT_FILE_MAX_BYTES) + '\n... (truncated)';
    if (total + content.length > ROOT_FILE_TOTAL_CAP) break;
    out[e.name] = content;
    total += content.length;
  }
  return out;
}

function loadSkillFromInstall(skillDir) {
  const main = existsSync(join(skillDir, 'SKILL.md')) ? readFileSync(join(skillDir, 'SKILL.md'), 'utf8') : '';
  const detect = existsSync(join(skillDir, 'detect.md')) ? readFileSync(join(skillDir, 'detect.md'), 'utf8') : '';
  const fwDir = join(skillDir, 'frameworks');
  const frameworks = {};
  if (existsSync(fwDir)) for (const f of readdirSync(fwDir)) {
    if (!f.endsWith('.md')) continue;
    frameworks[f.replace(/\.md$/, '')] = readFileSync(join(fwDir, f), 'utf8');
  }
  return { main, detect, frameworks };
}

function parseRulesJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  let body = text.slice(start).replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(body); }
  catch {
    const lastBrace = body.lastIndexOf('}');
    const truncated = lastBrace > 0 ? body.slice(0, lastBrace + 1) : body + '}';
    try { return JSON.parse(truncated); } catch { return null; }
  }
}

function filePattern(file) {
  const base = file.split('/').pop() ?? file;
  const m = base.match(/(\.[a-z0-9]+\.[a-z]+)$/i);
  if (m) return `*${m[1]}`;
  const ext = base.match(/(\.[a-z0-9]+)$/i);
  return ext ? `*${ext[1]}` : base;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function printSummary(rules, fileSlug) {
  console.log('');
  console.log('=== BOOTSTRAP COMPLETE ===');
  if (rules.project) {
    console.log(`project:       ${rules.project.kind ?? '?'} | ${rules.project.language ?? '?'} | ${rules.project.framework ?? '?'}`);
    if (rules.project.apps?.length) console.log(`apps:          ${rules.project.apps.length} (${rules.project.apps.slice(0, 4).map((a) => a.name).join(', ')}${rules.project.apps.length > 4 ? ', …' : ''})`);
    if (rules.project.summary) console.log(`summary:       ${rules.project.summary}`);
  }
  const totals = {};
  let unmapped = 0;
  for (const entry of Object.values(fileSlug)) {
    if (entry.slugs.length === 0) unmapped += 1;
    for (const slug of entry.slugs) totals[slug] = (totals[slug] ?? 0) + 1;
  }
  console.log('files→slug:');
  for (const slug of ['service', 'contracts', 'config', 'integrations']) {
    console.log(`  ${slug.padEnd(13)} ${(totals[slug] ?? 0).toString().padStart(4)}`);
  }
  console.log(`  unmapped     ${unmapped.toString().padStart(4)}`);
  console.log('');
  console.log('next: fabrick fullscan <repo>');
}
