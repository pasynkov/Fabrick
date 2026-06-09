import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

export interface FabrickConfig {
  version: number;
  orgSlug: string;
  projectId: string;
  projectSlug: string;
  repoId: string;
  repoName: string;
  gitRemote: string;
  agent: 'claude' | 'codex' | 'gemini' | 'none';
  apiUrl: string;
  scan: {
    ignore: string[];
    rebuildThreshold: Record<string, number>;
  };
}

const AGENTS = new Set(['claude', 'codex', 'gemini', 'none']);

function validateConfig(obj: unknown): FabrickConfig {
  if (!obj || typeof obj !== 'object') throw new Error('config.json is not a valid JSON object');
  const c = obj as Record<string, unknown>;
  const required = ['version', 'orgSlug', 'projectId', 'projectSlug', 'repoId', 'repoName', 'gitRemote', 'agent', 'apiUrl'];
  for (const field of required) {
    if (!(field in c)) throw new Error(`config.json missing required field: ${field}`);
  }
  if (!AGENTS.has(c.agent as string)) {
    throw new Error(`config.json: agent must be one of claude, codex, gemini, none — got: ${c.agent}`);
  }
  if (!c.scan || typeof c.scan !== 'object') {
    (c as any).scan = { ignore: [], rebuildThreshold: {} };
  }
  const scan = c.scan as Record<string, unknown>;
  if (!Array.isArray(scan.ignore)) scan.ignore = [];
  if (!scan.rebuildThreshold || typeof scan.rebuildThreshold !== 'object') {
    scan.rebuildThreshold = {};
  }
  return c as unknown as FabrickConfig;
}

@Injectable()
export class ConfigService {
  private readonly configPath: string;

  constructor(cwd = process.cwd()) {
    this.configPath = resolve(cwd, '.fabrick', 'config.json');
  }

  getConfigPath(): string {
    return this.configPath;
  }

  load(): FabrickConfig {
    const yamlPath = join(this.configPath, '..', 'config.yaml');
    if (existsSync(yamlPath) && !existsSync(this.configPath)) {
      console.error('Found .fabrick/config.yaml but no .fabrick/config.json.');
      console.error('The CLI has been upgraded to v2. Please run: fabrick init');
      process.exit(1);
    }
    if (!existsSync(this.configPath)) {
      console.error('No .fabrick/config.json found. Run: fabrick init');
      process.exit(1);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(this.configPath, 'utf8'));
    } catch (e: any) {
      console.error(`Failed to parse .fabrick/config.json: ${e.message}`);
      process.exit(1);
    }
    try {
      return validateConfig(raw);
    } catch (e: any) {
      console.error(e.message);
      process.exit(1);
    }
  }

  save(config: FabrickConfig): void {
    const dir = join(this.configPath, '..');
    mkdirSync(dir, { recursive: true });
    const tmp = this.configPath + '.tmp';
    writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
    renameSync(tmp, this.configPath);
  }

  get(path: string): unknown {
    const config = this.load();
    return resolvePath(config as unknown as Record<string, unknown>, path);
  }

  set(path: string, value: unknown): void {
    const config = this.load();
    setPath(config as unknown as Record<string, unknown>, path, value);
    this.save(config);
  }
}

function resolvePath(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function coerceConfigValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const n = Number(raw);
  if (!isNaN(n) && raw.trim() !== '') return n;
  try { return JSON.parse(raw); } catch { /* not JSON */ }
  return raw;
}
