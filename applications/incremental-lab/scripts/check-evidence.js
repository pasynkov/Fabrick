#!/usr/bin/env node
// Walk every wiki and synthesis markdown page, extract [name](path) links,
// resolve them against the actual filesystem, and report broken/orphan links.
//
// Usage:
//   node scripts/check-evidence.js wiki <repo>
//   node scripts/check-evidence.js synthesis <out-dir> --repos=r1,r2

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { wikiDir } from '../src/cli/state.js';

const argv = process.argv.slice(2);
const mode = argv[0];
const target = argv[1];

if (!mode || !target || !['wiki', 'synthesis'].includes(mode)) {
  console.error('usage:');
  console.error('  node scripts/check-evidence.js wiki <repo>');
  console.error('  node scripts/check-evidence.js synthesis <out-dir> --repos=r1,r2');
  process.exit(1);
}

// Match standard markdown links [text](path); skip absolute http(s) and anchors.
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function extractLinks(body) {
  const out = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(body)) !== null) {
    const path = m[2].trim();
    if (/^https?:/i.test(path) || path.startsWith('#') || path.startsWith('mailto:')) continue;
    out.push({ text: m[1], path });
  }
  return out;
}

function checkWiki(repoPath) {
  const wDir = wikiDir(repoPath);
  if (!existsSync(wDir)) { console.error(`no wiki at ${wDir}`); process.exit(1); }
  const stats = { pages: 0, links: 0, broken: 0 };
  const broken = [];
  for (const dir of readdirSync(wDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const scopeDir = join(wDir, dir.name);
    // scope root in the source repo
    const scopeRoot = join(repoPath, dir.name.replace(/__/g, '/'));
    for (const f of readdirSync(scopeDir)) {
      if (!f.endsWith('.md') || f === 'index.md' || f.startsWith('_')) continue;
      const pagePath = join(scopeDir, f);
      const body = readFileSync(pagePath, 'utf8');
      stats.pages += 1;
      for (const link of extractLinks(body)) {
        stats.links += 1;
        // Strip optional anchor / line-range hash.
        const cleanPath = link.path.split('#')[0];
        if (!cleanPath) continue;
        const abs = resolve(scopeRoot, cleanPath);
        if (!existsSync(abs)) {
          stats.broken += 1;
          broken.push({ page: pagePath.replace(repoPath, ''), link: link.path, resolved: abs.replace(repoPath, ''), text: link.text });
        }
      }
    }
  }
  return { stats, broken };
}

function checkSynthesis(outDir, repoPaths) {
  const repoMap = {};
  for (const p of repoPaths) repoMap[basename(p)] = p;

  const stats = { pages: 0, links: 0, broken: 0 };
  const broken = [];

  for (const f of readdirSync(outDir)) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue;
    const pagePath = join(outDir, f);
    const body = readFileSync(pagePath, 'utf8');
    stats.pages += 1;
    for (const link of extractLinks(body)) {
      stats.links += 1;
      const path = link.path.split('#')[0];
      if (!path) continue;
      // Expected form: repos/<repoName>/scopes/<dir>/<slug>
      const m = path.match(/^repos\/([^/]+)\/scopes\/([^/]+)\/([^/]+)$/);
      if (!m) {
        // Direct file reference (unusual). Try resolving in first repo.
        stats.broken += 1;
        broken.push({ page: f, link: path, kind: 'unparseable', text: link.text });
        continue;
      }
      const [, repoName, dirName, slug] = m;
      const repoPath = repoMap[repoName];
      if (!repoPath) {
        stats.broken += 1;
        broken.push({ page: f, link: path, kind: 'unknown-repo', text: link.text });
        continue;
      }
      const abs = join(wikiDir(repoPath), dirName, slug);
      if (!existsSync(abs)) {
        stats.broken += 1;
        broken.push({ page: f, link: path, kind: 'missing-wiki', resolved: abs, text: link.text });
      }
    }
  }
  return { stats, broken };
}

let result;
if (mode === 'wiki') {
  result = checkWiki(target);
} else {
  const repoPaths = (argv.find((a) => a.startsWith('--repos='))?.split('=')[1] ?? '').split(',').filter(Boolean);
  if (repoPaths.length === 0) { console.error('--repos required for synthesis mode'); process.exit(1); }
  result = checkSynthesis(target, repoPaths);
}

const { stats, broken } = result;
console.log(`=== ${mode.toUpperCase()} EVIDENCE CHECK ===`);
console.log(`pages:   ${stats.pages}`);
console.log(`links:   ${stats.links}`);
console.log(`broken:  ${stats.broken}  (${stats.links > 0 ? (stats.broken / stats.links * 100).toFixed(1) : 0}%)`);
if (broken.length) {
  console.log('\nbroken samples (first 20):');
  for (const b of broken.slice(0, 20)) {
    console.log(`  [${b.page}] "${b.text}" -> ${b.link}${b.kind ? ` (${b.kind})` : ''}`);
  }
  if (broken.length > 20) console.log(`  ... ${broken.length - 20} more`);
  process.exit(1);
}
