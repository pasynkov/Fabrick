import { spawn } from 'node:child_process';

const DEFAULT_MODEL = 'sonnet';

export async function callClaude(prompt, {
  model = DEFAULT_MODEL,
  jsonSchema = null,
  maxBudgetUsd = 1,
  timeoutMs = 120_000,
  cwd = process.cwd(),
} = {}) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', model,
    '--no-session-persistence',
    '--max-budget-usd', String(maxBudgetUsd),
  ];
  if (jsonSchema) args.push('--json-schema', JSON.stringify(jsonSchema));

  const t0 = Date.now();
  const { stdout, stderr, code } = await runProcess('claude', args, { input: prompt, cwd, timeoutMs });
  const wallMs = Date.now() - t0;

  if (code !== 0) {
    throw new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`);
  }

  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch (e) {
    throw new Error(`Could not parse claude JSON: ${e.message}\nstdout head: ${stdout.slice(0, 300)}`);
  }
  if (parsed.is_error) {
    throw new Error(`claude reported error: ${parsed.subtype} ${parsed.api_error_status ?? ''}`);
  }
  return {
    content: parsed.result,
    usage: parsed.usage,
    costUsd: parsed.total_cost_usd,
    durationMs: parsed.duration_ms,
    wallMs,
    sessionId: parsed.session_id,
    raw: parsed,
  };
}

function runProcess(cmd, args, { input, cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    if (input) { child.stdin.write(input); }
    child.stdin.end();
  });
}
