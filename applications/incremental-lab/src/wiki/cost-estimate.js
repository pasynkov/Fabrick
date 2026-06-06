/**
 * Cheap size-estimator used by the patch CLI to decide, per scope, whether
 * to run the incremental compute+apply pipeline or just regenerate the
 * scope from scratch (which has zero drift). Estimation is TOKEN-based —
 * pricing is volatile, token counts are stable across model and pricing
 * changes. No LLM call, no tree-sitter.
 *
 * Returned shape from estimate*Cost is { inTok, outTok, totalTok }.
 * dynamicThreshold takes total tokens of a hypothetical fullscan.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TOK_PER_BYTE = 0.25;            // 1 token ~ 4 bytes
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
 * Estimated token counts for a fresh generateAppScope call (one sonnet call).
 */
export function estimateFullscanTokens(sourceBytes) {
  const systemOverhead = 4000;
  const inTok = tokens(sourceBytes + systemOverhead);
  const outTok = 2000;          // ~4 page bodies of ~500 tok each
  return { inTok, outTok, totalTok: inTok + outTok };
}

/**
 * Estimated token counts for compute+apply patch for a scope. Worst-case
 * assumes all 4 slugs trigger an apply call.
 */
export function estimatePatchTokens(diffBytes, existingPagesBytes) {
  const computeSystemOverhead = 3000;
  const computeInTok = tokens(diffBytes + existingPagesBytes + computeSystemOverhead);
  const computeOutTok = 800;    // patch instructions

  const applySystemOverhead = 1500;
  const applyInTok = tokens(existingPagesBytes + 1500 + applySystemOverhead);
  const applyOutTok = tokens(existingPagesBytes);

  return {
    inTok: computeInTok + applyInTok,
    outTok: computeOutTok + applyOutTok,
    totalTok: computeInTok + computeOutTok + applyInTok + applyOutTok,
  };
}

export function sumExistingPagesBytes(existingPages) {
  let total = 0;
  for (const body of Object.values(existingPages ?? {})) total += (body ?? '').length;
  return total;
}

/**
 * Dynamic patch/fullscan-ratio threshold that adapts to content size in
 * TOKENS (not dollars — pricing is volatile, tokens are stable).
 *
 * Cheap content (small fullscan) → low threshold (rebuild aggressively
 * because patch saves only a tiny absolute amount and rebuilds eliminate
 * drift). Expensive content → high threshold (patch unless diff is huge).
 *
 * threshold = base + scale * log10(fullscanTotalTok / refTok)
 * clamped to [min, max].
 *
 * Defaults centered on 8K tokens — a typical small wiki scope. Anchors:
 *    1K tokens → threshold 0.30 (always rebuild on tiny content)
 *    8K tokens → threshold 0.50
 *   80K tokens → threshold 0.75
 *  800K tokens → threshold 0.90 (only rebuild on extreme refactors)
 */
export function dynamicThreshold(fullscanTotalTok, opts = {}) {
  const base   = opts.base   ?? 0.5;
  const scale  = opts.scale  ?? 0.25;
  const refTok = opts.refTok ?? 8000;
  const min    = opts.min    ?? 0.30;
  const max    = opts.max    ?? 0.90;
  const ratio  = Math.max(fullscanTotalTok / refTok, 0.01);
  const tr     = base + scale * Math.log10(ratio);
  return Math.max(min, Math.min(max, tr));
}

/**
 * Synthesis-side estimates. Bundle bytes = sum of all wiki pages fed to
 * the synthesis prompt. Changed bundle bytes = sum of before+after bodies
 * of wiki pages whose fingerprint moved.
 */
export function estimateSynthesisFullscanTokens(bundleBytes) {
  const skillOverhead = 6000;
  const inTok = tokens(bundleBytes + skillOverhead);
  const outTok = 2500;
  return { inTok, outTok, totalTok: inTok + outTok };
}

export function estimateSynthesisPatchTokens(changedBundleBytes, existingTopicsBytes) {
  const computeOverhead = 4000;
  const computeInTok = tokens(existingTopicsBytes + changedBundleBytes + computeOverhead);
  const computeOutTok = 700;
  const applyOverhead = 2000;
  const applyInTok = tokens(existingTopicsBytes + 1500 + applyOverhead);
  const applyOutTok = tokens(existingTopicsBytes);
  return {
    inTok: computeInTok + applyInTok,
    outTok: computeOutTok + applyOutTok,
    totalTok: computeInTok + computeOutTok + applyInTok + applyOutTok,
  };
}
