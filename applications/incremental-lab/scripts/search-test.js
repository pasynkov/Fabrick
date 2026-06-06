#!/usr/bin/env node
// Test how answers to fixed questions evolve as wiki + synthesis snapshots
// advance over a project's history. Bundles all synthesis pages + every
// wiki page (lightweight — ~10 pages total per iter, frontmatter stripped),
// sends the bundle + question to claude, records the answer.
//
// Usage:
//   node scripts/search-test.js \
//     --synthesis-history=/Users/pasynkov/dev/Nami/.fabrick-synthesis/history \
//     --wiki-repos=/Users/pasynkov/dev/Nami/backend1,/Users/pasynkov/dev/Nami/kustomize \
//     --iters=0,3,5

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { callClaude } from '../src/llm/cli.js';
import { stripFrontmatter } from '../src/wiki/frontmatter.js';
import { fabrickDir } from '../src/cli/state.js';
import { stableJson } from '../src/snapshot/store.js';

const QUESTIONS = [
  { id: 'q1', q: 'How does harvester/reaper persist trade data downstream? Name the storage system(s) and the path the data takes.' },
  { id: 'q2', q: 'What environment variables does harvester/reaper expose for Google Cloud Platform access?' },
  { id: 'q3', q: 'How many replicas does binance/vision-connector run with in Kubernetes, and what is its update strategy?' },
  { id: 'q4', q: 'Does any service explicitly register a NATS connection in its sentinel options at bootstrap? Which one(s)?' },
  { id: 'q5', q: 'Walk me through the end-to-end trade ingestion pipeline from Binance Vision source to the analytical warehouse.' },
];

const argv = process.argv.slice(2);
const synthHistory = argv.find((a) => a.startsWith('--synthesis-history='))?.split('=')[1];
const wikiRepos = (argv.find((a) => a.startsWith('--wiki-repos='))?.split('=')[1] ?? '').split(',').filter(Boolean);
const itersArg = argv.find((a) => a.startsWith('--iters='))?.split('=')[1];
const iters = itersArg ? itersArg.split(',').map(Number) : [0, 3, 5];
const outDir = argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? join(process.cwd(), '.lab', 'search-test');

if (!synthHistory || wikiRepos.length === 0) {
  console.error('usage: --synthesis-history=<dir> --wiki-repos=r1,r2 [--iters=0,3,5] [--out=<dir>]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

function readMd(p) { return stripFrontmatter(readFileSync(p, 'utf8')).content; }

function bundleCorpus(iter) {
  const blocks = [];
  // synthesis
  const sDir = join(synthHistory, `iter-${iter}`);
  if (existsSync(sDir)) {
    blocks.push('=== SYNTHESIS ===');
    for (const f of readdirSync(sDir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      blocks.push(`--- synthesis/${f} ---`);
      blocks.push(readMd(join(sDir, f)));
    }
  }
  // wiki per repo
  for (const repoPath of wikiRepos) {
    const repoName = basename(repoPath);
    const wDir = join(fabrickDir(repoPath), 'history', `iter-${iter}`, 'wiki');
    if (!existsSync(wDir)) continue;
    blocks.push(`\n=== WIKI: ${repoName} ===`);
    for (const dir of readdirSync(wDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const sub = join(wDir, dir.name);
      for (const f of readdirSync(sub)) {
        if (!f.endsWith('.md') || f === 'index.md' || f.startsWith('_')) continue;
        blocks.push(`--- ${repoName}/${dir.name}/${f} ---`);
        blocks.push(readMd(join(sub, f)));
      }
    }
  }
  return blocks.join('\n');
}

const SYSTEM_TEMPLATE = `You are answering questions about a software system using a bundle of documentation pages.

DOCUMENT BUNDLE (synthesis + per-repo wiki):
<<<BUNDLE>>>

RULES:
- Answer ONLY from the bundle. If the answer is not present, say "Not documented in this snapshot".
- Be concise: 2-5 sentences in a BRIEF: section, then a SOURCES: line listing the doc paths you used (comma-separated, in the form "synthesis/<slug>" or "<repo>/<scope-dir>/<slug>").
- Do NOT use tools. Output ONLY the BRIEF: and SOURCES: sections, nothing else.

FORMAT (strict):
BRIEF:
<answer paragraph>

SOURCES: synthesis/system.md, backend1/apps__harvester__reaper/service.md
`;

const report = { iters: [], questions: QUESTIONS.map((q) => ({ ...q })) };
let totalCost = 0;

for (const iter of iters) {
  console.log(`\n=== iter ${iter} ===`);
  const bundle = bundleCorpus(iter);
  const sizeKb = (bundle.length / 1024).toFixed(1);
  const system = SYSTEM_TEMPLATE.replace('<<<BUNDLE>>>', bundle);
  console.log(`bundle: ${sizeKb}KB`);
  const iterRec = { iter, bundleBytes: bundle.length, answers: [] };

  for (const q of QUESTIONS) {
    const t0 = Date.now();
    const res = await callClaude({ system, user: q.q }, { model: 'sonnet', timeoutMs: 300_000 });
    const cost = res.costUsd ?? 0;
    totalCost += cost;
    const ms = Date.now() - t0;
    iterRec.answers.push({ id: q.id, q: q.q, answer: res.content, costUsd: cost, durationMs: ms });
    console.log(`  ${q.id}: ${ms}ms $${cost.toFixed(4)}`);
  }
  report.iters.push(iterRec);
}

report.totalCostUsd = totalCost;
writeFileSync(join(outDir, 'report.json'), stableJson(report));

// Render comparative report
const lines = ['# Search drift report', ''];
for (const q of QUESTIONS) {
  lines.push(`## ${q.id}`, `**Q:** ${q.q}`, '');
  for (const ir of report.iters) {
    const a = ir.answers.find((x) => x.id === q.id);
    lines.push(`### iter-${ir.iter}`, a.answer, '');
  }
}
writeFileSync(join(outDir, 'report.md'), lines.join('\n'));

console.log(`\ntotal cost: $${totalCost.toFixed(2)}`);
console.log(`wrote: ${outDir}/report.md + report.json`);
