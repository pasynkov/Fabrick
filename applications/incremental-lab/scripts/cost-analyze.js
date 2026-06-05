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
const APPLY_MODEL = argv.find((a) => a.startsWith('--apply-model='))?.split('=')[1] ?? 'haiku';
const p = PRICING[MODEL];

const PHASE_PRICING = {
  compute: PRICING[MODEL],
  apply: PRICING[APPLY_MODEL],
  fullrebuild: PRICING[MODEL],
  judge: PRICING[MODEL],
};

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
    const PROMPT_RESPONSE_MAP = {
      'compute.prompt.txt': { resp: 'compute.response.md', bucket: 'compute' },
      'apply.prompt.txt':   { resp: 'apply.response.md',   bucket: 'apply' },
      'essence.prompt.txt': { resp: 'essence.response.md', bucket: 'compute' },
      'patch.prompt.txt':   { resp: 'patch.response.md',   bucket: 'apply' },
      'prompt.txt':         { resp: 'response.md',         bucket: phase },
    };
    const map = PROMPT_RESPONSE_MAP[e.name];
    if (map) {
      const promptText = readFileSync(p, 'utf8');
      let response = '';
      try { response = readFileSync(join(dir, map.resp), 'utf8'); } catch {}
      const { system, user } = splitSystemUser(promptText);
      const bucket = map.bucket;
      stats[bucket].calls += 1;
      stats[bucket].system += tok(system);
      stats[bucket].user += tok(user);
      stats[bucket].output += tok(response);
    }
  }
}

walk(ROOT);

function sdkCost(bucket, phase, opts = { cacheSystem: true }) {
  const pp = PHASE_PRICING[phase] ?? p;
  const inputUser = bucket.user;
  const inputSystem = bucket.system;
  const output = bucket.output;
  if (opts.cacheSystem && bucket.calls > 0 && inputSystem > 0) {
    const perCallSystem = inputSystem / bucket.calls;
    const cwrite = perCallSystem * pp.cwrite5m / 1_000_000;
    const cread = perCallSystem * (bucket.calls - 1) * pp.cread / 1_000_000;
    const usrCost = inputUser * pp.input / 1_000_000;
    const outCost = output * pp.output / 1_000_000;
    return cwrite + cread + usrCost + outCost;
  }
  return ((inputUser + inputSystem) * pp.input + output * pp.output) / 1_000_000;
}

console.log(`=== SDK-EQUIVALENT COST ANALYSIS ===`);
console.log(`source: ${ROOT}`);
console.log(`pricing per phase:`);
for (const [phase, pp] of Object.entries(PHASE_PRICING)) {
  console.log(`  ${phase.padEnd(12)} in=$${pp.input}/M out=$${pp.output}/M cwrite=$${pp.cwrite5m}/M cread=$${pp.cread}/M`);
}
console.log();
console.log(`phase         calls    sys-tok    usr-tok    out-tok    sdk$ (cached)    sdk$ (no-cache)`);
console.log(`──────────────────────────────────────────────────────────────────────────────────────`);
let totalCached = 0;
let totalNoCache = 0;
for (const [phase, b] of Object.entries(stats)) {
  const cached = sdkCost(b, phase, { cacheSystem: true });
  const noCache = sdkCost(b, phase, { cacheSystem: false });
  totalCached += cached; totalNoCache += noCache;
  console.log(`${phase.padEnd(13)} ${String(b.calls).padStart(5)}  ${String(b.system).padStart(8)}  ${String(b.user).padStart(8)}  ${String(b.output).padStart(8)}    $${cached.toFixed(4).padStart(8)}        $${noCache.toFixed(4).padStart(8)}`);
}
console.log(`──────────────────────────────────────────────────────────────────────────────────────`);
console.log(`TOTAL                                                  $${totalCached.toFixed(4).padStart(8)}        $${totalNoCache.toFixed(4).padStart(8)}`);
console.log();
console.log(`incremental cost (apply + compute) cached:    $${(sdkCost(stats.compute,'compute',{cacheSystem:true}) + sdkCost(stats.apply,'apply',{cacheSystem:true})).toFixed(4)}`);
console.log(`full-rescan cost cached:                       $${sdkCost(stats.fullrebuild,'fullrebuild',{cacheSystem:true}).toFixed(4)}`);
console.log(`judge cost cached:                             $${sdkCost(stats.judge,'judge',{cacheSystem:true}).toFixed(4)}`);
