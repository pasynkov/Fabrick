import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { walkRepo } from './walk.js';
import { Extractor } from '../extract/extractor.js';

export const SNAPSHOT_VERSION = 1;

export function buildSnapshot(repoRoot, opts = {}) {
  const files = {};
  const allSymbols = [];
  const paths = walkRepo(repoRoot, opts);
  const extractor = new Extractor();

  for (const rel of paths) {
    const abs = join(repoRoot, rel);
    const source = readFileSync(abs, 'utf8');
    files[rel] = { hash: hashContent(source) };
    let symbols = [];
    try { symbols = extractor.extract(rel, source); }
    catch (e) { files[rel].extractError = e.message; }
    for (const s of symbols) allSymbols.push(s);
  }

  allSymbols.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: SNAPSHOT_VERSION, files, symbols: allSymbols };
}

function hashContent(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
