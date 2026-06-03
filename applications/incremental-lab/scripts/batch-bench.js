#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const promptPath = process.argv[2] ?? join(process.cwd(), '.lab/demo/nami-backend1-assets/02-patch/patches/entities_InstrumentsController/03-prompt.txt');
const N = Number(process.argv[3] ?? 5);
const model = process.argv[4] ?? 'sonnet';

const basePrompt = readFileSync(promptPath, 'utf8');
console.log(`[setup] prompt source: ${promptPath}`);
console.log(`[setup] prompt size: ${(basePrompt.length / 1024).toFixed(1)} KB`);
console.log(`[setup] turns: ${N}  model: ${model}`);

const variants = Array.from({ length: N }, (_, i) =>
  `${basePrompt}\n\n--- BATCH MARKER ${i + 1} of ${N} — output a 1-line summary only (skip the full update for this batch test) ---`
);

console.log('\n=== SEQUENTIAL ===');
let seqTotal = 0;
const t0seq = Date.now();
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const cost = await runOne(variants[i], model);
  seqTotal += cost;
  console.log(`  call ${i + 1}/${N}  $${cost.toFixed(4)}  ${Date.now() - t}ms`);
}
const seqWall = Date.now() - t0seq;
console.log(`  TOTAL: $${seqTotal.toFixed(4)}  ${seqWall}ms`);

console.log('\n=== BATCHED (stream-json) ===');
const t0batch = Date.now();
const { perTurn, total } = await runStream(variants, model);
const batchWall = Date.now() - t0batch;
console.log(`  per-turn cost: ${perTurn.map((c) => '$' + c.toFixed(4)).join(' + ')}`);
console.log(`  TOTAL: $${total.toFixed(4)}  ${batchWall}ms`);

const saving = ((1 - total / seqTotal) * 100).toFixed(1);
console.log('\n=== COMPARISON ===');
console.log(`  sequential: $${seqTotal.toFixed(4)}  ${(seqWall / 1000).toFixed(1)}s`);
console.log(`  batched:    $${total.toFixed(4)}  ${(batchWall / 1000).toFixed(1)}s`);
console.log(`  saving:     ${saving}%  (cost)`);

function runOne(prompt, model) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', model, '--no-session-persistence']);
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`exit ${code}`));
      try { resolve(JSON.parse(stdout).total_cost_usd ?? 0); }
      catch (e) { reject(e); }
    });
    child.on('error', reject);
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function runStream(prompts, model) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '-p', '--input-format', 'stream-json', '--output-format', 'stream-json',
      '--verbose', '--model', model, '--no-session-persistence',
    ]);
    let buf = '';
    const perTurn = [];
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'result' && typeof obj.total_cost_usd === 'number') {
            perTurn.push(obj.total_cost_usd);
          }
        } catch {}
      }
    });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`exit ${code}`));
      resolve({ perTurn, total: perTurn.reduce((s, x) => s + x, 0) });
    });
    child.on('error', reject);
    for (const p of prompts) {
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: p } }) + '\n');
    }
    child.stdin.end();
  });
}
