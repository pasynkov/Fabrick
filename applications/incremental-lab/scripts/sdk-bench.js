#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callSDK, callSDKWithCache } from '../src/llm/sdk.js';

const promptPath = process.argv[2] ?? join(process.cwd(), '.lab/demo/nami-backend1-assets/02-patch/patches/entities_InstrumentsController/03-prompt.txt');
const N = Number(process.argv[3] ?? 5);
const model = process.argv[4] ?? 'sonnet';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const basePrompt = readFileSync(promptPath, 'utf8');
console.log(`[setup] prompt: ${promptPath}`);
console.log(`[setup] prompt size: ${(basePrompt.length / 1024).toFixed(1)} KB`);
console.log(`[setup] turns: ${N}  model: ${model}`);

const variants = Array.from({ length: N }, (_, i) => {
  const marker = `\n\n--- BATCH MARKER ${i + 1} of ${N} — output a 1-line summary only (skip the full update for this batch test) ---`;
  return basePrompt + marker;
});

const { systemStatic, systemDynamic, userTemplate } = splitForCache(basePrompt);
console.log(`[split] systemStatic ${(systemStatic.length / 1024).toFixed(1)} KB, systemDynamic ${(systemDynamic.length / 1024).toFixed(1)} KB, user ${(userTemplate.length / 1024).toFixed(1)} KB`);

console.log('\n=== CLI sequential ===');
const cliResults = [];
const t0cli = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const r = await runCli(variants[i], model);
  cliResults.push({ ...r, wallMs: Date.now() - t });
  console.log(`  call ${i + 1}/${N}  $${r.costUsd.toFixed(4)}  ${Date.now() - t}ms`);
}
const cliCost = cliResults.reduce((s, r) => s + r.costUsd, 0);
const cliWall = Date.now() - t0cli;
console.log(`  TOTAL: $${cliCost.toFixed(4)}  ${cliWall}ms`);

console.log('\n=== SDK without cache ===');
const sdkNoCacheResults = [];
const t0nc = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const r = await callSDK({ user: variants[i], model });
  sdkNoCacheResults.push(r);
  const u = r.usage;
  console.log(`  call ${i + 1}/${N}  $${r.costUsd.toFixed(4)}  in=${u.input_tokens} out=${u.output_tokens}  ${Date.now() - t}ms`);
}
const sdkNoCacheCost = sdkNoCacheResults.reduce((s, r) => s + r.costUsd, 0);
const sdkNoCacheWall = Date.now() - t0nc;
console.log(`  TOTAL: $${sdkNoCacheCost.toFixed(4)}  ${sdkNoCacheWall}ms`);

console.log('\n=== SDK with ephemeral cache (5min, full prompt cached as system) ===');
const sdkCacheResults = [];
const t0c = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const userMarker = `BATCH MARKER ${i + 1} of ${N} — output a 1-line summary only (skip the full update for this batch test).`;
  const r = await callSDKWithCache({
    systemStatic: basePrompt,
    systemDynamic: '',
    user: userMarker,
    model,
  });
  sdkCacheResults.push(r);
  const u = r.usage;
  console.log(`  call ${i + 1}/${N}  $${r.costUsd.toFixed(4)}  in=${u.input_tokens} cw=${u.cache_creation_input_tokens ?? 0} cr=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}  ${Date.now() - t}ms`);
}
const sdkCacheCost = sdkCacheResults.reduce((s, r) => s + r.costUsd, 0);
const sdkCacheWall = Date.now() - t0c;
console.log(`  TOTAL: $${sdkCacheCost.toFixed(4)}  ${sdkCacheWall}ms`);

console.log('\n=== COMPARISON ===');
const rows = [
  ['CLI sequential',       cliCost,        cliWall],
  ['SDK no cache',         sdkNoCacheCost, sdkNoCacheWall],
  ['SDK + ephemeral cache', sdkCacheCost,   sdkCacheWall],
];
const baseline = rows[0][1];
for (const [name, cost, wall] of rows) {
  const ratio = baseline > 0 ? cost / baseline : 1;
  console.log(`  ${name.padEnd(24)} $${cost.toFixed(4)}  ${(wall / 1000).toFixed(1)}s   x${ratio.toFixed(2)} vs CLI`);
}

function runCli(prompt, model) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', model, '--no-session-persistence']);
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
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function splitForCache(prompt) {
  const idx = prompt.indexOf('PAGE SLUG:');
  if (idx < 0) return { systemStatic: prompt.slice(0, 200), systemDynamic: '', userTemplate: prompt };
  const systemStatic = prompt.slice(0, idx).trim();
  const userTemplate = prompt.slice(idx);
  return { systemStatic, systemDynamic: '', userTemplate };
}
