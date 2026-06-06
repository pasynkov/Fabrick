#!/usr/bin/env node
// Measure drift of patched-chain synthesis vs fresh-genesis synthesis at the
// same wiki state. Workflow:
//   1. Snapshot current synthesis pages as ground-truth A (must be a fresh
//      genesis on the current wiki state — caller's responsibility).
//   2. Run replay-synthesis (forces a genesis at iter 0 then 5 patches).
//   3. Resulting .fabrick-synthesis/*.md = patched-iter-N state (B).
//   4. Judge each topic A vs B using superset-aware judge:
//        score, equivalent, (LOSS-IN-A) / (CONTRADICT) / (EXTRA-IN-A) buckets.
//
// Usage:
//   node scripts/measure-synth-drift.js <synth-out> --ground-truth=/tmp/...

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { judge } from '../src/llm/judge.js';
import { stripFrontmatter } from '../src/wiki/frontmatter.js';
import { SYNTHESIS_PAGE_SLUGS } from '../src/llm/synthesis-prompts.js';
import { stableJson } from '../src/snapshot/store.js';

const argv = process.argv.slice(2);
const synthDir = argv[0];
const groundDir = argv.find((a) => a.startsWith('--ground-truth='))?.split('=')[1];

if (!synthDir || !groundDir) {
  console.error('usage: node measure-synth-drift.js <synth-dir> --ground-truth=<path>');
  process.exit(1);
}

const stats = [];
let totalCost = 0;
let totalScore = 0;

console.log('topic                  score  equiv  loss  contra  extra  $');
console.log('────────────────────────────────────────────────────────────');

for (const slug of SYNTHESIS_PAGE_SLUGS) {
  const aPath = join(synthDir, slug);
  const bPath = join(groundDir, slug);
  if (!existsSync(aPath) || !existsSync(bPath)) {
    console.log(`${slug.padEnd(22)}  MISSING`);
    continue;
  }
  const a = stripFrontmatter(readFileSync(aPath, 'utf8')).content;
  const b = stripFrontmatter(readFileSync(bPath, 'utf8')).content;

  const v = await judge({
    pageA: a, pageB: b,
    context: `Synthesis topic "${slug}". A = chain-of-patches result. B = fresh genesis at same wiki state. Score how much A drifted from B (superset-aware).`,
    claudeOpts: { model: 'sonnet', timeoutMs: 600_000 },
  });

  const diffs = v.differences ?? [];
  const loss = diffs.filter((d) => d.startsWith('(LOSS-IN-A)')).length;
  const contra = diffs.filter((d) => d.startsWith('(CONTRADICT)')).length;
  const extra = diffs.filter((d) => d.startsWith('(EXTRA-IN-A)')).length;
  totalCost += v.costUsd ?? 0;
  totalScore += v.score ?? 0;
  stats.push({ slug, score: v.score, equivalent: v.equivalent, loss, contra, extra, costUsd: v.costUsd, diffs });
  console.log(`${slug.padEnd(22)}  ${v.score.toFixed(2)}   ${v.equivalent ? 'yes' : 'no '}   ${String(loss).padStart(3)}  ${String(contra).padStart(5)}  ${String(extra).padStart(4)}  $${(v.costUsd ?? 0).toFixed(3)}`);
}

console.log('────────────────────────────────────────────────────────────');
const avg = stats.length ? totalScore / stats.length : 0;
console.log(`avg score: ${avg.toFixed(2)}  judge cost: $${totalCost.toFixed(3)}`);

writeFileSync(join(synthDir, '_drift-vs-genesis.json'), stableJson({
  groundDir, avgScore: avg, judgeCostUsd: totalCost, topics: stats,
}));
