import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

export interface ClaudeCallOptions {
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5';
  systemPrompt: string;
  userInput: string;
  tools?: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface ClaudeResult {
  content: string;
  costUsd?: number;
  durationMs?: number;
  usage?: unknown;
}

export class ClaudeCodeError extends Error {
  constructor(public readonly exitCode: number | null, public readonly stderr: string) {
    super(`claude exited ${exitCode}: ${stderr.slice(0, 500)}`);
    this.name = 'ClaudeCodeError';
  }
}

@Injectable()
export class ClaudeCodeService {
  async call(opts: ClaudeCallOptions): Promise<ClaudeResult> {
    const {
      model,
      systemPrompt,
      userInput,
      tools = '',
      timeoutMs = 300_000,
      cwd = process.cwd(),
    } = opts;

    const settings = JSON.stringify({ enabledPlugins: { caveman: false } });
    const args = [
      '-p',
      '--output-format', 'json',
      '--model', model,
      '--no-session-persistence',
      '--system-prompt', systemPrompt,
      '--tools', tools,
      '--disable-slash-commands',
      '--settings', settings,
    ];

    const { stdout, stderr, code } = await runProcess('claude', args, { input: userInput, cwd, timeoutMs });

    if (code !== 0) {
      throw new ClaudeCodeError(code, stderr);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdout);
    } catch (e: any) {
      throw new Error(`Could not parse claude JSON: ${e.message}\nstdout head: ${stdout.slice(0, 300)}`);
    }

    if (parsed.is_error) {
      throw new ClaudeCodeError(1, `claude reported error: ${parsed.subtype} ${parsed.api_error_status ?? ''}`);
    }

    return {
      content: parsed.result ?? '',
      costUsd: parsed.total_cost_usd,
      durationMs: parsed.duration_ms,
      usage: parsed.usage,
    };
  }

  async callParallel(calls: ClaudeCallOptions[]): Promise<ClaudeResult[]> {
    return Promise.all(calls.map((c) => this.call(c)));
  }
}

function runProcess(cmd: string, args: string[], { input, cwd, timeoutMs }: { input: string; cwd: string; timeoutMs: number }): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    const k = env.ANTHROPIC_API_KEY;
    if (!k || k.startsWith('sk-ant-oat')) delete env.ANTHROPIC_API_KEY;
    const child = spawn(cmd, args, { cwd, env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`claude timed out after ${timeoutMs}ms`)); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    if (input) { child.stdin.write(input); }
    child.stdin.end();
  });
}
