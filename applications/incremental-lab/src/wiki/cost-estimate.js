/**
 * Cheap cost-estimator used by the patch CLI to decide, per scope, whether
 * to run the incremental compute+apply pipeline or just regenerate the
 * scope from scratch (which has zero drift). Estimation is byte-based — no
 * LLM call, no tree-sitter.
 *
 * Numbers come from observed per-PR runs on Nami; treat them as a guide,
 * not exact predictions. The decision is binary anyway.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TOK_PER_BYTE = 0.25;            // 1 token ~ 4 bytes
const PRICE = {
  sonnetIn: 3,    sonnetOut: 15,
  haikuIn: 1,     haikuOut: 5,
};

function tokens(bytes) { return Math.ceil(bytes * TOK_PER_BYTE); }

/**
 * Total bytes of source files in a scope (recursive, source-ish file types only).
 * Caps each file at MAX_FILE_BYTES so a giant generated file doesn't skew the call.
 */
const MAX_FILE_BYTES = 8000;
const MAX_FILES = 60;
const SOURCE_EXT = /\.(tsx?|jsx?|py|go|java|kt|rb|cs|rs|yaml|yml|json|md)$/i;
const SKIP_DIR = /^(node_modules|dist|build|coverage|\.git|\.fabrick)$/;

export function estimateScopeSourceBytes(scopePath) {
  let total = 0;
  let count = 0;
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (count >= MAX_FILES) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIR.test(e.name)) continue;
        walk(full);
        continue;
      }
      if (!e.isFile() || !SOURCE_EXT.test(e.name)) continue;
      let size;
      try { size = statSync(full).size; } catch { continue; }
      total += Math.min(size, MAX_FILE_BYTES);
      count += 1;
    }
  }
  walk(scopePath);
  return { bytes: total, fileCount: count };
}

/**
 * Estimated cost of a fresh generateAppScope call (sonnet, all source in).
 */
export function estimateFullscanCost(sourceBytes) {
  const systemOverhead = 4000;
  const inTok = tokens(sourceBytes + systemOverhead);
  const outTok = 2000;   // ~4 page bodies of ~500 tokens each
  return ((inTok * PRICE.sonnetIn) + (outTok * PRICE.sonnetOut)) / 1_000_000;
}

/**
 * Estimated cost of compute+apply patch for a scope. Worst-case assumes all
 * 4 slugs need an apply call.
 */
export function estimatePatchCost(diffBytes, existingPagesBytes) {
  const computeSystemOverhead = 3000;
  const computeInTok = tokens(diffBytes + existingPagesBytes + computeSystemOverhead);
  const computeOutTok = 800;   // patch instructions
  const computeCost = ((computeInTok * PRICE.sonnetIn) + (computeOutTok * PRICE.sonnetOut)) / 1_000_000;

  // apply (haiku) — sees existing pages of changed slugs + patch
  const applySystemOverhead = 1500;
  const applyInTok = tokens(existingPagesBytes + 1500 + applySystemOverhead);
  const applyOutTok = tokens(existingPagesBytes);   // regen pages
  const applyCost = ((applyInTok * PRICE.haikuIn) + (applyOutTok * PRICE.haikuOut)) / 1_000_000;

  return computeCost + applyCost;
}

export function sumExistingPagesBytes(existingPages) {
  let total = 0;
  for (const body of Object.values(existingPages ?? {})) total += (body ?? '').length;
  return total;
}
