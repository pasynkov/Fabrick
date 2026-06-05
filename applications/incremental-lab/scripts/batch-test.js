#!/usr/bin/env node
// Compare 3 strategies for running N compute calls:
//   A) PARALLEL — N separate `claude -p` subprocesses (current).
//   B) SEQUENTIAL — N separate subprocesses one after another.
//   C) BATCH — single subprocess with stream-json input/output; each call
//      is a new turn in the same conversation (context accumulates).
//
// We reuse the 4 compute prompts already saved on disk by the latest patch run.

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const PROMPT_FILES = [
  '/Users/pasynkov/dev/Nami/backend1/.fabrick/wiki/apps__harvester__reaper/_compute.prompt.txt',
  '/Users/pasynkov/dev/Nami/backend1/.fabrick/wiki/apps__harvester__conductor/_compute.prompt.txt',
  '/Users/pasynkov/dev/Nami/backend1/.fabrick/wiki/apps__binance__vision-connector/_compute.prompt.txt',
  '/Users/pasynkov/dev/Nami/backend1/.fabrick/wiki/apps__assets__registry/_compute.prompt.txt',
];

function split(promptText) {
  const m = promptText.match(/^---\s*system\s*---\n([\s\S]*?)\n\n---\s*user\s*---\n([\s\S]*)$/);
  return m ? { system: m[1], user: m[2] } : { system: '', user: promptText };
}

const prompts = PROMPT_FILES.map((p) => split(readFileSync(p, 'utf8')));
console.log(`loaded ${prompts.length} compute prompts`);
for (const [i, p] of prompts.entries()) console.log(`  [${i}] system ${p.system.length}B user ${p.user.length}B`);

const CLAUDE_BASE_ARGS = [
  '-p', '--model', 'sonnet', '--no-session-persistence',
  '--max-budget-usd', '2',
  '--tools', '',
  '--disable-slash-commands',
  '--settings', JSON.stringify({ enabledPlugins: { 'caveman@caveman': false } }),
];

function runOne(prompt, label) {
  const args = [...CLAUDE_BASE_ARGS, '--output-format', 'json', '--system-prompt', prompt.system];
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const p = spawn('claude', args);
    let out = '', err = '';
    p.stdout.on('data', (d) => out += d.toString());
    p.stderr.on('data', (d) => err += d.toString());
    p.on('close', (code) => {
      const ms = Date.now() - t0;
      try {
        const j = JSON.parse(out);
        resolve({ label, ms, cost: j.total_cost_usd, usage: j.usage, response: j.result });
      } catch (e) { reject(new Error(`parse: ${e.message}\nout: ${out.slice(0,300)}\nerr: ${err.slice(0,300)}`)); }
    });
    p.stdin.end(prompt.user);
  });
}

// Drip-feed user messages: only send the next one after we've seen a `result`
// event for the previous turn. Otherwise the CLI processes them as one big
// batch and only emits a result for the last.
function runBatch(systemPrompt, userMessages) {
  const args = [
    ...CLAUDE_BASE_ARGS,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--system-prompt', systemPrompt,
  ];
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const p = spawn('claude', args);
    let buf = '';
    let results = [];
    let cursor = 0;
    let err = '';
    p.stderr.on('data', (d) => err += d.toString());
    p.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('{')) continue;
        let j; try { j = JSON.parse(line); } catch { continue; }
        if (j.type === 'result') {
          results.push(j);
          cursor += 1;
          if (cursor < userMessages.length) {
            const next = userMessages[cursor];
            p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: next } }) + '\n');
          } else {
            p.stdin.end();
          }
        }
      }
    });
    p.on('close', () => {
      const ms = Date.now() - t0;
      resolve({ ms, results, err });
    });
    // Prime with first message
    if (userMessages.length === 0) { p.stdin.end(); return; }
    p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: userMessages[0] } }) + '\n');
  });
}

async function main() {
  // Warm-up call to ensure CC wrapper cache is hot for all subsequent measurements.
  console.log('\n[warm-up] tiny call to prime cache…');
  await runOne({ system: 'Say only OK', user: 'hi' }, 'warmup');

  console.log('\n=== A) PARALLEL (4 subprocesses concurrently) ===');
  const tA = Date.now();
  const a = await Promise.all(prompts.map((p, i) => runOne(p, `A${i}`)));
  const msA = Date.now() - tA;
  const costA = a.reduce((s, r) => s + (r.cost ?? 0), 0);
  for (const r of a) console.log(`  ${r.label}: ${r.ms}ms cost=$${(r.cost ?? 0).toFixed(4)}`);
  console.log(`PARALLEL wall=${msA}ms total cost=$${costA.toFixed(4)}`);

  console.log('\n=== B) SEQUENTIAL (4 subprocesses one after another) ===');
  const tB = Date.now();
  const b = [];
  for (let i = 0; i < prompts.length; i++) b.push(await runOne(prompts[i], `B${i}`));
  const msB = Date.now() - tB;
  const costB = b.reduce((s, r) => s + (r.cost ?? 0), 0);
  for (const r of b) console.log(`  ${r.label}: ${r.ms}ms cost=$${(r.cost ?? 0).toFixed(4)}`);
  console.log(`SEQUENTIAL wall=${msB}ms total cost=$${costB.toFixed(4)}`);

  console.log('\n=== C) BATCH (1 subprocess, 4 turns, shared system) ===');
  // We use the FIRST scope's system prompt for all turns (they are conceptually equivalent — same compute task framing).
  const tC = Date.now();
  const c = await runBatch(prompts[0].system, prompts.map((p) => p.user));
  console.log(`BATCH wall=${c.ms}ms`);
  let costC = 0;
  for (const [i, r] of c.results.entries()) {
    const cost = r.total_cost_usd ?? 0;
    costC += cost;
    const u = r.usage ?? {};
    console.log(`  C${i}: cost=$${cost.toFixed(4)} cache_creation=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} input=${u.input_tokens ?? 0} output=${u.output_tokens ?? 0}`);
  }
  console.log(`BATCH total cost=$${costC.toFixed(4)}`);

  console.log('\n=== SUMMARY ===');
  console.log(`PARALLEL    $${costA.toFixed(4)}  wall ${msA}ms`);
  console.log(`SEQUENTIAL  $${costB.toFixed(4)}  wall ${msB}ms`);
  console.log(`BATCH       $${costC.toFixed(4)}  wall ${c.ms}ms`);
}

main().catch((e) => { console.error(e); process.exit(1); });
