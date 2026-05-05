import { spawnSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { parse } from 'yaml';

const API_URL = process.env.FABRICK_API_URL || 'http://localhost:3000';
const AZURE_CONN_STR =
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
const CLI_BIN = resolve(__dirname, '../bin/fabrick.js');
const MCP_BIN =
  process.env.MCP_DIST_PATH || resolve(__dirname, '../../../mcp/dist/index.js');
const MOCK_SYNTHESIS = '# Mock synthesis';

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
  const reg = await apiPost<{ access_token: string }>('/auth/register', {
    email,
    password: 'TestPassword123!',
  });
  const accessToken = reg.access_token;

  // Get CLI token (requires JWT access_token)
  const cliTokenRes = await apiPost<{ token: string }>('/auth/cli-token', {}, accessToken);
  cliToken = cliTokenRes.token;

  // Get the auto-created org
  const orgs = await apiGet<Array<{ id: string; slug: string }>>('/orgs', cliToken);
  const org = orgs[0];
  orgSlug = org.slug;

  // Create project
  const project = await apiPost<{ id: string; slug: string }>(
    `/orgs/${org.id}/projects`,
    { name: 'ci-test-project' },
    cliToken,
  );
  projectSlug = project.slug;

  // Set up temp working dir with git remote (needed for fabrick init)
  tmpDir = join(tmpdir(), `fabrick-e2e-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  spawnSync('git', ['init'], { cwd: tmpDir });
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/test/repo.git'], {
    cwd: tmpDir,
  });

  // Find-or-create repo
  const repo = await apiPost<{ id: string }>(
    '/repos/find-or-create',
    { gitRemote: 'https://github.com/test/repo.git', projectId: project.id },
    cliToken,
  );
  repoId = repo.id;

  // Get MCP token
  const mcpTokenRes = await apiPost<{ token: string }>(
    '/auth/mcp-token',
    { orgSlug, projectSlug, repoId },
    cliToken,
  );
  mcpToken = mcpTokenRes.token;

  // Upload mock synthesis to Azurite
  const blobClient = BlobServiceClient.fromConnectionString(AZURE_CONN_STR);
  const containerClient = blobClient.getContainerClient(orgSlug);
  await containerClient.createIfNotExists();
  const blockBlob = containerClient.getBlockBlobClient(
    `${projectSlug}/synthesis/index.md`,
  );
  await blockBlob.upload(MOCK_SYNTHESIS, Buffer.byteLength(MOCK_SYNTHESIS));
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
  it('writes config.yaml with correct repo_id and exits 0', () => {
    const result = spawnSync(
      'node',
      [CLI_BIN, 'init', '--non-interactive', '--org', orgSlug, '--project', projectSlug],
      { cwd: tmpDir, env: { ...process.env, FABRICK_API_URL: API_URL } },
    );
    expect(result.status).toBe(0);
    const config = parse(
      readFileSync(join(tmpDir, '.fabrick', 'config.yaml'), 'utf8'),
    ) as { repo_id: string };
    expect(config.repo_id).toBe(repoId);
  });
});

describe('fabrick push', () => {
  it('exits 0 with mock context file', () => {
    mkdirSync(join(tmpDir, '.fabrick', 'context'), { recursive: true });
    writeFileSync(join(tmpDir, '.fabrick', 'context', 'mock.md'), '# Mock context');
    const result = spawnSync('node', [CLI_BIN, 'push'], {
      cwd: tmpDir,
      env: { ...process.env, FABRICK_API_URL: API_URL },
    });
    expect(result.status).toBe(0);
  });
});

describe('MCP stdio', () => {
  it('get_synthesis_index returns mock synthesis content', async () => {
    const mcpProcess = spawn('node', [MCP_BIN], {
      env: { ...process.env, FABRICK_TOKEN: mcpToken, FABRICK_API_URL: API_URL },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send all frames upfront — MCP SDK processes them sequentially
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
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_synthesis_index', arguments: {} },
      }) + '\n',
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
            if (parsed.id === 3) {
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

    expect(msg.result?.content?.[0]?.text).toBe(MOCK_SYNTHESIS);
  });
});
