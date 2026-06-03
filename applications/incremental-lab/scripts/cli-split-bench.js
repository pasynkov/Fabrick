#!/usr/bin/env node
// A/B: monolithic user prompt vs split (static → --system-prompt, dynamic → user)
// Subscription auth only.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const promptPath = process.argv[2] ?? join(process.cwd(), '.lab/demo/nami-backend1-assets/02-patch/patches/entities_InstrumentsController/03-prompt.txt');
const N = Number(process.argv[3] ?? 5);
const model = process.argv[4] ?? 'sonnet';

const fullPrompt = readFileSync(promptPath, 'utf8');

// Split: static = everything from "INSTRUCTIONS:" to FORMAT_HINT (the policy block)
// dynamic = everything before INSTRUCTIONS (slug, existing, changes, signatures, source)
const splitMarker = '\nINSTRUCTIONS:';
const idx = fullPrompt.indexOf(splitMarker);
let staticPart = '';
let dynamicPart = fullPrompt;
if (idx > 0) {
  dynamicPart = fullPrompt.slice(0, idx).trim();
  staticPart = fullPrompt.slice(idx).trim();
}
console.log(`[split] static ${(staticPart.length / 1024).toFixed(1)} KB  dynamic ${(dynamicPart.length / 1024).toFixed(1)} KB`);
console.log(`[turns] ${N}  model: ${model}`);

const variants = Array.from({ length: N }, (_, i) => ({
  unique: `\n--- batch marker ${i + 1}/${N} — output 1-line summary only ---`,
}));

const settingsOverride = JSON.stringify({ enabledPlugins: { 'caveman@caveman': false } });

console.log('\n=== A: MONOLITHIC (static + dynamic in single user prompt) ===');
const aRes = [];
const t0a = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const r = await runCli({
    systemPrompt: 'You are a precise technical writer. Follow instructions exactly. Return only what is asked, no preamble.',
    user: fullPrompt + variants[i].unique,
    model,
  });
  aRes.push(r);
  const u = r.usage ?? {};
  console.log(`  call ${i + 1}  $${r.costUsd.toFixed(4)}  in=${u.input_tokens ?? 0} cw=${u.cache_creation_input_tokens ?? 0} cr=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens ?? 0}  ${Date.now() - t}ms`);
}
const aCost = aRes.reduce((s, r) => s + r.costUsd, 0);
const aWall = Date.now() - t0a;
console.log(`  TOTAL: $${aCost.toFixed(4)}  ${aWall}ms`);

console.log('\n=== B: SPLIT (static → --system-prompt, dynamic → user) ===');
const bRes = [];
const t0b = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const r = await runCli({
    systemPrompt: staticPart,
    user: dynamicPart + variants[i].unique,
    model,
  });
  bRes.push(r);
  const u = r.usage ?? {};
  console.log(`  call ${i + 1}  $${r.costUsd.toFixed(4)}  in=${u.input_tokens ?? 0} cw=${u.cache_creation_input_tokens ?? 0} cr=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens ?? 0}  ${Date.now() - t}ms`);
}
const bCost = bRes.reduce((s, r) => s + r.costUsd, 0);
const bWall = Date.now() - t0b;
console.log(`  TOTAL: $${bCost.toFixed(4)}  ${bWall}ms`);

console.log('\n=== COMPARISON ===');
const baseline = aCost;
const rows = [
  ['A monolithic', aCost, aWall],
  ['B split static→system', bCost, bWall],
];
for (const [name, cost, wall] of rows) {
  console.log(`  ${name.padEnd(24)} $${cost.toFixed(4)}  ${(wall / 1000).toFixed(1)}s   x${(cost / baseline).toFixed(2)} vs A`);
}

function runCli({ systemPrompt, user, model }) {
  const args = [
    '-p', '--output-format', 'json',
    '--model', model,
    '--no-session-persistence',
    '--system-prompt', systemPrompt,
    '--tools', '',
    '--disable-slash-commands',
    '--settings', settingsOverride,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args);
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`exit ${code}`));
      try {
        const parsed = JSON.parse(stdout);
        resolve({ costUsd: parsed.total_cost_usd ?? 0, usage: parsed.usage });
      } catch (e) { reject(e); }
    });
    child.on('error', reject);
    child.stdin.write(user);
    child.stdin.end();
  });
}
