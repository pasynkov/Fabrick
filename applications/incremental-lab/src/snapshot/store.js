import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeSnapshot(dir, snap) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'files.json'), stableJson({ version: snap.version, files: snap.files }));
  writeFileSync(join(dir, 'symbols.json'), stableJson({ version: snap.version, symbols: snap.symbols }));
}

export function readSnapshot(dir) {
  const files = JSON.parse(readFileSync(join(dir, 'files.json'), 'utf8'));
  const symbols = JSON.parse(readFileSync(join(dir, 'symbols.json'), 'utf8'));
  return { version: files.version, files: files.files, symbols: symbols.symbols };
}

export function writeSourcemap(dir, sourcemap) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sourcemap.json'), stableJson(sourcemap));
}

export function readSourcemap(dir) {
  return JSON.parse(readFileSync(join(dir, 'sourcemap.json'), 'utf8'));
}

export function stableJson(value) {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
