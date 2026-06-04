#!/usr/bin/env node
// Walk a bench artifact tree and compute SDK-equivalent costs (pricing as if
// we used @anthropic-ai/sdk direct, no Claude Code wrapper).
//
// For each LLM call we have prompt.txt + response.md saved. Token counts are
// estimated as bytes/4 (heuristic). The script splits per phase:
//   compute      essence calls
//   apply        patch + baseline-full calls
//   fullrebuild  ground-truth full generations
//   judge        judge calls
//
// Sonnet 4.6 pricing:
//   input        $3.00 / 1M
//   output       $15.00 / 1M
//   cache write  $3.75 / 1M  (5m TTL)
//   cache read   $0.30 / 1M

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const argv = process.argv.slice(2);
const ROOT = argv.find((a) => !a.startsWith('--')) ?? '.lab/wiki-minimal';

const PRICING = {
  sonnet: { input: 3, output: 15, cwrite5m: 3.75, cread: 0.30 },
  haiku:  { input: 1, output: 5,  cwrite5m: 1.25, cread: 0.10 },
};

const CHARS_PER_TOKEN = 4;
const tok = (s) => Math.ceil((s?.length ?? 0) / CHARS_PER_TOKEN);

const MODEL = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const p = PRICING[MODEL];

const stats = {
  compute:    { calls: 0, system: 0, user: 0, output: 0 },
  apply:      { calls: 0, system: 0, user: 0, output: 0 },
  fullrebuild:{ calls: 0, system: 0, user: 0, output: 0 },
  judge:      { calls: 0, system: 0, user: 0, output: 0 },
};

function classifyDir(dir) {
  const b = basename(dir);
  if (b === 'patch')       return 'apply';
  if (b === 'fullrebuild') return 'fullrebuild';
  if (b === 'judge')       return 'judge';
  return null;
}

function splitSystemUser(promptText) {
  if (!promptText) return { system: '', user: '' };
  // page-generator wrapper saves `--- system ---\n<sys>\n\n--- user ---\n<user>`
  const m = promptText.match(/^---\s*system\s*---\n([\s\S]*?)\n\n---\s*user\s*---\n([\s\S]*)$/);
  if (m) return { system: m[1], user: m[2] };
  // CLI fallback: prompt is the whole user message; we don't see system content
  return { system: '', user: promptText };
}

function walk(dir, depth = 0) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p, depth + 1); continue; }
    if (!e.isFile()) continue;
    const phase = classifyDir(dir);
    if (!phase) continue;

    // Collect prompt + response pairs
    if (e.name === 'patch.prompt.txt' || e.name === 'prompt.txt' || e.name === 'essence.prompt.txt') {
      const promptText = readFileSync(p, 'utf8');
      const responseName = e.name === 'essence.prompt.txt'
        ? 'essence.response.md'
        : (e.name === 'patch.prompt.txt' ? 'patch.response.md' : 'response.md');
      const responsePath = join(dir, responseName);
      let response = '';
      try { response = readFileSync(responsePath, 'utf8'); }
      catch {}

      const { system, user } = splitSystemUser(promptText);
      const bucket = e.name === 'essence.prompt.txt' ? 'compute' : phase;
      stats[bucket].calls += 1;
      stats[bucket].system += tok(system);
      stats[bucket].user += tok(user);
      stats[bucket].output += tok(response);
    }
  }
}

walk(ROOT);

function sdkCost(bucket, opts = { cacheSystem: true }) {
  const inputUser = bucket.user;
  const inputSystem = bucket.system;
  const output = bucket.output;
  if (opts.cacheSystem && bucket.calls > 0 && inputSystem > 0) {
    // First call writes system to cache, rest read
    const perCallSystem = inputSystem / bucket.calls;
    const cwrite = perCallSystem * p.cwrite5m / 1_000_000;
    const cread = perCallSystem * (bucket.calls - 1) * p.cread / 1_000_000;
    const usrCost = inputUser * p.input / 1_000_000;
    const outCost = output * p.output / 1_000_000;
    return cwrite + cread + usrCost + outCost;
  }
  return ((inputUser + inputSystem) * p.input + output * p.output) / 1_000_000;
}

console.log(`=== SDK-EQUIVALENT COST ANALYSIS (${MODEL}) ===`);
console.log(`source: ${ROOT}`);
console.log(`pricing: input=$${p.input}/M, output=$${p.output}/M, cache_write=$${p.cwrite5m}/M, cache_read=$${p.cread}/M`);
console.log();
console.log(`phase         calls    sys-tok    usr-tok    out-tok    sdk$ (cached)    sdk$ (no-cache)`);
console.log(`──────────────────────────────────────────────────────────────────────────────────────`);
let totalCached = 0;
let totalNoCache = 0;
for (const [phase, b] of Object.entries(stats)) {
  const cached = sdkCost(b, { cacheSystem: true });
  const noCache = sdkCost(b, { cacheSystem: false });
  totalCached += cached; totalNoCache += noCache;
  console.log(`${phase.padEnd(13)} ${String(b.calls).padStart(5)}  ${String(b.system).padStart(8)}  ${String(b.user).padStart(8)}  ${String(b.output).padStart(8)}    $${cached.toFixed(4).padStart(8)}        $${noCache.toFixed(4).padStart(8)}`);
}
console.log(`──────────────────────────────────────────────────────────────────────────────────────`);
console.log(`TOTAL                                                  $${totalCached.toFixed(4).padStart(8)}        $${totalNoCache.toFixed(4).padStart(8)}`);
console.log();
console.log(`incremental cost (apply + compute) cached:    $${(sdkCost(stats.compute, {cacheSystem:true}) + sdkCost(stats.apply, {cacheSystem:true})).toFixed(4)}`);
console.log(`full-rescan cost cached:                       $${sdkCost(stats.fullrebuild, {cacheSystem:true}).toFixed(4)}`);
console.log(`judge cost cached:                             $${sdkCost(stats.judge, {cacheSystem:true}).toFixed(4)}`);
