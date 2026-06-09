import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { walkRepo } from './walk';
import { TypeScriptExtractor } from '../extract/typescript';
import { YamlExtractor } from '../extract/yaml';

export const SNAPSHOT_VERSION = 1;

export interface Snapshot {
  version: number;
  files: Record<string, { hash: string; extractError?: string }>;
  symbols: unknown[];
}

export function buildSnapshot(repoRoot: string, opts: { extensions?: Set<string>; ignore?: Set<string> } = {}): Snapshot {
  const files: Record<string, { hash: string; extractError?: string }> = {};
  const allSymbols: unknown[] = [];
  const paths = walkRepo(repoRoot, opts);
  const tsExtractor = new TypeScriptExtractor();
  const yamlExtractor = new YamlExtractor();

  for (const rel of paths) {
    const abs = join(repoRoot, rel);
    let source: string;
    try { source = readFileSync(abs, 'utf8'); } catch { continue; }
    files[rel] = { hash: hashContent(source) };
    let symbols: unknown[] = [];
    try {
      if (tsExtractor.supports(rel)) symbols = tsExtractor.extract(rel, source);
      else if (yamlExtractor.supports(rel)) symbols = yamlExtractor.extract(rel, source);
    } catch (e: any) {
      files[rel].extractError = e.message;
    }
    for (const s of symbols) allSymbols.push(s);
  }

  (allSymbols as any[]).sort((a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: SNAPSHOT_VERSION, files, symbols: allSymbols };
}

function hashContent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
