#!/usr/bin/env node
// Test stream-json + subscription auth (NO --bare, NO API key)
// + --system-prompt to replace 29K default + --tools "" to drop tool defs
// + session reuse across turns

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const promptPath = process.argv[2] ?? join(process.cwd(), '.lab/demo/nami-backend1-assets/02-patch/patches/entities_InstrumentsController/03-prompt.txt');
const N = Number(process.argv[3] ?? 5);
const model = process.argv[4] ?? 'sonnet';

const basePrompt = readFileSync(promptPath, 'utf8');
console.log(`[setup] prompt: ${basePrompt.length} chars, ${N} turns, model=${model}`);

const variants = Array.from({ length: N }, (_, i) =>
  `${basePrompt}\n\n--- BATCH MARKER ${i + 1} of ${N} — output a 1-line summary only ---`
);

const sessionId = randomUUID();

const args = [
  '-p',
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--verbose',
  '--model', model,
  '--no-session-persistence',
  '--session-id', sessionId,
  '--system-prompt', 'You are a precise technical writer. Follow instructions exactly. Return only what is asked, no preamble.',
  '--tools', '',
  '--disable-slash-commands',
  '--settings', JSON.stringify({ model: 'sonnet', enabledPlugins: {}, mcpServers: {}, hooks: {} }),
];

console.log(`[args] claude ${args.join(' ')}`);
console.log(`[session-id] ${sessionId}`);

const t0 = Date.now();
const child = spawn('claude', args);
let buf = '';
const turns = [];

child.stdout.on('data', (d) => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'result' && typeof obj.total_cost_usd === 'number') {
        const u = obj.usage ?? {};
        turns.push({
          cost: obj.total_cost_usd,
          input: u.input_tokens, cw: u.cache_creation_input_tokens ?? 0,
          cr: u.cache_read_input_tokens ?? 0, output: u.output_tokens,
        });
        const last = turns[turns.length - 1];
        console.log(`  turn ${turns.length} $${last.cost.toFixed(4)} in=${last.input} cw=${last.cw} cr=${last.cr} out=${last.output}`);
      }
    } catch {}
  }
});

child.stderr.on('data', (d) => process.stderr.write(d));
child.on('close', (code) => {
  const wall = Date.now() - t0;
  console.log(`\n[done] exit=${code} wall=${(wall / 1000).toFixed(1)}s`);
  const total = turns.reduce((s, t) => s + t.cost, 0);
  console.log(`[total] $${total.toFixed(4)} across ${turns.length} turns`);
  if (turns.length >= 2) {
    const first = turns[0].cost;
    const rest = turns.slice(1).reduce((s, t) => s + t.cost, 0);
    const restAvg = rest / (turns.length - 1);
    console.log(`[breakdown] turn1=$${first.toFixed(4)}  avg-rest=$${restAvg.toFixed(4)}`);
  }
});

for (const p of variants) {
  child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: p } }) + '\n');
}
child.stdin.end();
