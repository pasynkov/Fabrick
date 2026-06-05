import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stableJson } from '../snapshot/store.js';

export function fabrickDir(repoPath) {
  return join(repoPath, '.fabrick');
}

export function statePath(repoPath) {
  return join(fabrickDir(repoPath), 'state.json');
}

export function rulesPath(repoPath) {
  return join(fabrickDir(repoPath), 'routing-rules.json');
}

export function fileSlugMapPath(repoPath) {
  return join(fabrickDir(repoPath), 'file-slug-map.json');
}

export function wikiDir(repoPath) {
  return join(fabrickDir(repoPath), 'wiki');
}

export function readState(repoPath) {
  const p = statePath(repoPath);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function writeState(repoPath, state) {
  mkdirSync(fabrickDir(repoPath), { recursive: true });
  writeFileSync(statePath(repoPath), stableJson(state));
}

export function readRules(repoPath) {
  const p = rulesPath(repoPath);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}
