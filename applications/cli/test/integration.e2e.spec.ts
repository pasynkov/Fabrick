import { spawnSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { parse } from 'yaml';

const API_URL = process.env.FABRICK_API_URL || 'http://localhost:3000';
const CLI_BIN = resolve(__dirname, '../bin/fabrick.js');
const MCP_BIN =
  process.env.MCP_DIST_PATH || resolve(__dirname, '../../../mcp/dist/index.js');

let cliToken: string;
let mcpToken: string;
let orgSlug: string;
let projectSlug: string;
let repoId: string;
let tmpDir: string;

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`POST ${path} failed: ${(err as any).message || res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  // Register user — gets an auto-created org from the email slug
  const email = `ci-e2e-${Date.now()}@example.com`;
  const reg = await apiPost<{ access_token: string }>('/v1/auth/register', {
    email,
    password: 'TestPassword123!',
  });
  const accessToken = reg.access_token;

  // Get CLI token
  const cliTokenRes = await apiPost<{ token: string }>('/v1/auth/cli-token', {}, accessToken);
  cliToken = cliTokenRes.token;

  // Get the auto-created org
  const orgs = await apiGet<Array<{ id: string; slug: string }>>('/v1/orgs', cliToken);
  const org = orgs[0];
  orgSlug = org.slug;

  // Create project
  const project = await apiPost<{ id: string; slug: string }>(
    `/v1/orgs/${org.id}/projects`,
    { name: 'ci-test-project' },
    cliToken,
  );
  projectSlug = project.slug;

  // Set up temp working dir with git remote
  tmpDir = join(tmpdir(), `fabrick-e2e-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  spawnSync('git', ['init'], { cwd: tmpDir });
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/test/repo.git'], {
    cwd: tmpDir,
  });

  // Find-or-create repo
  const repo = await apiPost<{ id: string }>(
    '/v1/repos/find-or-create',
    { gitRemote: 'https://github.com/test/repo.git', projectId: project.id },
    cliToken,
  );
  repoId = repo.id;

  // Get MCP token
  const mcpTokenRes = await apiPost<{ token: string }>(
    '/v1/auth/mcp-token',
    { orgSlug, projectSlug, repoId },
    cliToken,
  );
  mcpToken = mcpTokenRes.token;
});

afterAll(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe('fabrick login --token', () => {
  it('writes credentials.yaml and exits 0', () => {
    const result = spawnSync('node', [CLI_BIN, 'login', '--token', cliToken], {
      cwd: tmpDir,
      env: { ...process.env, FABRICK_API_URL: API_URL },
    });
    expect(result.status).toBe(0);
    const creds = parse(
      readFileSync(join(tmpDir, '.fabrick', 'credentials.yaml'), 'utf8'),
    ) as { token: string; api_url: string };
    expect(creds.token).toBe(cliToken);
    expect(creds.api_url).toBe(API_URL);
  });
});

describe('fabrick init --non-interactive', () => {
  it('writes config.json with correct repo and project fields and exits 0', () => {
    const result = spawnSync(
      'node',
      [CLI_BIN, 'init', '--non-interactive', '--org', orgSlug, '--project', projectSlug,
       '--api-url', API_URL, '--agent', 'none'],
      { cwd: tmpDir, env: { ...process.env, FABRICK_API_URL: API_URL } },
    );
    expect(result.status).toBe(0);
    const config = JSON.parse(
      readFileSync(join(tmpDir, '.fabrick', 'config.json'), 'utf8'),
    ) as { repoId: string; projectId: string; version: number };
    expect(config.repoId).toBe(repoId);
    expect(config.version).toBe(2);
  });
});

describe('MCP stdio', () => {
  it('lists fabrick_search tool', async () => {
    const mcpProcess = spawn('node', [MCP_BIN], {
      env: { ...process.env, FABRICK_TOKEN: mcpToken, FABRICK_API_URL: API_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    mcpProcess.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }) + '\n',
    );
    mcpProcess.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
    );
    mcpProcess.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n',
    );

    const msg = await new Promise<any>((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('MCP response timeout'));
      }, 15000);

      mcpProcess.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString();
        for (const line of buf.split('\n')) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === 2) {
              clearTimeout(timer);
              mcpProcess.kill();
              resolve(parsed);
            }
          } catch {
            // partial or non-JSON line
          }
        }
      });

      mcpProcess.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(msg.result?.tools?.[0]?.name).toBe('fabrick_search');
  });
});
