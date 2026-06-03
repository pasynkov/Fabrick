#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });
import { existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { writeSnapshot } from '../src/snapshot/store.js';

const OUT_ROOT = join(process.cwd(), '.lab', 'snapshots');

const repos = Object.entries(process.env)
  .filter(([k]) => k.startsWith('NAMI_REPO_'))
  .map(([k, path]) => ({ key: k.replace('NAMI_REPO_', '').toLowerCase(), path }));

if (repos.length === 0) {
  console.error('No NAMI_REPO_* env vars set. Copy .env.local.example to .env.local first.');
  process.exit(1);
}

mkdirSync(OUT_ROOT, { recursive: true });

for (const { key, path } of repos) {
  if (!existsSync(path)) {
    console.warn(`[skip] ${key}: path not found: ${path}`);
    continue;
  }
  const t0 = Date.now();
  const snap = buildSnapshot(path);
  const fileCount = Object.keys(snap.files).length;
  const dt = Date.now() - t0;
  if (fileCount === 0) {
    console.log(`[empty] ${key} (${basename(path)}): no .ts files found`);
    continue;
  }
  const outDir = join(OUT_ROOT, key);
  writeSnapshot(outDir, snap);
  console.log(`[ok] ${key.padEnd(12)} files=${String(fileCount).padStart(4)} symbols=${String(snap.symbols.length).padStart(5)} ${dt}ms → ${outDir}`);
}
