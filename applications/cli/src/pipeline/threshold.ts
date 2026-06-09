import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { Scope } from './scope/detect';

const TOK_PER_BYTE = 0.25;
function tokens(bytes: number): number { return Math.ceil(bytes * TOK_PER_BYTE); }

const MAX_FILE_BYTES = 8000;
const MAX_FILES = 60;
const SOURCE_EXT = /\.(tsx?|jsx?|py|go|java|kt|rb|cs|rs|yaml|yml|json|md)$/i;
const SKIP_DIR = /^(node_modules|dist|build|coverage|\.git|\.fabrick)$/;

export function estimateScopeSourceBytes(scopePath: string): { bytes: number; fileCount: number } {
  let total = 0;
  let count = 0;
  function walk(dir: string): void {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count >= MAX_FILES) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (SKIP_DIR.test(e.name)) continue; walk(full); continue; }
      if (!e.isFile() || !SOURCE_EXT.test(e.name)) continue;
      let size: number;
      try { size = statSync(full).size; } catch { continue; }
      total += Math.min(size, MAX_FILE_BYTES);
      count += 1;
    }
  }
  walk(scopePath);
  return { bytes: total, fileCount: count };
}

export function estimateFullscanTokens(sourceBytes: number): { inTok: number; outTok: number; totalTok: number } {
  const systemOverhead = 4000;
  const inTok = tokens(sourceBytes + systemOverhead);
  const outTok = 2000;
  return { inTok, outTok, totalTok: inTok + outTok };
}

export function estimatePatchTokens(diffBytes: number, existingPagesBytes: number): { inTok: number; outTok: number; totalTok: number } {
  const computeSystemOverhead = 3000;
  const computeInTok = tokens(diffBytes + existingPagesBytes + computeSystemOverhead);
  const computeOutTok = 800;
  const applySystemOverhead = 1500;
  const applyInTok = tokens(existingPagesBytes + 1500 + applySystemOverhead);
  const applyOutTok = tokens(existingPagesBytes);
  return {
    inTok: computeInTok + applyInTok,
    outTok: computeOutTok + applyOutTok,
    totalTok: computeInTok + computeOutTok + applyInTok + applyOutTok,
  };
}

export function dynamicThreshold(fullscanTotalTok: number, opts: { base?: number; scale?: number; refTok?: number; min?: number; max?: number } = {}): number {
  const base   = opts.base   ?? 0.5;
  const scale  = opts.scale  ?? 0.25;
  const refTok = opts.refTok ?? 8000;
  const min    = opts.min    ?? 0.30;
  const max    = opts.max    ?? 0.90;
  const ratio  = Math.max(fullscanTotalTok / refTok, 0.01);
  const tr     = base + scale * Math.log10(ratio);
  return Math.max(min, Math.min(max, tr));
}

export function computeRebuildThresholds(scopes: Scope[], cwd: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const scope of scopes) {
    const { bytes } = estimateScopeSourceBytes(join(cwd, scope.root));
    const { totalTok } = estimateFullscanTokens(bytes);
    result[scope.root] = dynamicThreshold(totalTok);
  }
  return result;
}
