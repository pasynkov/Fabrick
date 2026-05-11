import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface HashScanResult {
  mode: 'full' | 'incremental';
  changed: string[];
  added: string[];
  deleted: string[];
  totalFiles: number;
  hashmap: Record<string, string>;
}

const ALWAYS_IGNORE = new Set(['node_modules', '.fabrick', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'target', 'vendor', '__pycache__']);

function parseGitignorePatterns(rootPath: string): string[] {
  const gitignorePath = join(rootPath, '.gitignore');
  if (!existsSync(gitignorePath)) return [];
  return readFileSync(gitignorePath, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
}

function isIgnoredByPattern(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const clean = pattern.replace(/\/$/, '');
    if (clean.includes('/')) continue; // skip complex patterns
    const parts = relPath.split('/');
    if (parts.includes(clean)) return true;
  }
  return false;
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function walkFiles(dir: string, rootPath: string, gitignorePatterns: string[], results: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = relative(rootPath, fullPath).replace(/\\/g, '/');
    const topDir = relPath.split('/')[0];

    if (ALWAYS_IGNORE.has(entry) || ALWAYS_IGNORE.has(topDir)) continue;
    if (isIgnoredByPattern(relPath, gitignorePatterns)) continue;

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkFiles(fullPath, rootPath, gitignorePatterns, results);
    } else if (stat.isFile()) {
      results.push(relPath);
    }
  }
}

export function scanFiles(rootPath: string): Record<string, string> {
  const patterns = parseGitignorePatterns(rootPath);
  const files: string[] = [];
  walkFiles(rootPath, rootPath, patterns, files);
  const hashmap: Record<string, string> = {};
  for (const relPath of files) {
    try {
      hashmap[relPath] = hashFile(join(rootPath, relPath));
    } catch {
      // skip unreadable files
    }
  }
  return hashmap;
}

export function diffHashmaps(
  newHashmap: Record<string, string>,
  prevHashmap: Record<string, string>,
): { changed: string[]; added: string[]; deleted: string[] } {
  const changed: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];

  for (const [path, hash] of Object.entries(newHashmap)) {
    if (!(path in prevHashmap)) {
      added.push(path);
    } else if (prevHashmap[path] !== hash) {
      changed.push(path);
    }
  }

  for (const path of Object.keys(prevHashmap)) {
    if (!(path in newHashmap)) {
      deleted.push(path);
    }
  }

  return { changed, added, deleted };
}

export function computeScanResult(rootPath: string, force: boolean): HashScanResult {
  const newHashmap = scanFiles(rootPath);
  const hashmapPath = join(rootPath, '.fabrick', 'wiki', 'hashmap.json');

  if (!force && existsSync(hashmapPath)) {
    let prevHashmap: Record<string, string> = {};
    try {
      prevHashmap = JSON.parse(readFileSync(hashmapPath, 'utf-8'));
    } catch {
      // treat as empty
    }
    const { changed, added, deleted } = diffHashmaps(newHashmap, prevHashmap);
    return {
      mode: 'incremental',
      changed,
      added,
      deleted,
      totalFiles: Object.keys(newHashmap).length,
      hashmap: newHashmap,
    };
  }

  return {
    mode: 'full',
    changed: [],
    added: Object.keys(newHashmap),
    deleted: [],
    totalFiles: Object.keys(newHashmap).length,
    hashmap: newHashmap,
  };
}
