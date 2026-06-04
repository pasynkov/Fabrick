/**
 * Two-phase wiki patch: compute (expensive, dev-side) + apply (cheap, SDK-side).
 *
 * Compute produces a human-readable patch document (audit artifact).
 * Apply runs that patch against existing pages with no source/diff context.
 */

import { callClaude } from '../llm/cli.js';
import { computePatchPrompt, applyPatchPrompt, parsePatchOutput } from '../llm/patch-prompts.js';
import { parseAppPagesOutput } from '../llm/app-page-prompts.js';
import { APP_PAGES } from './app-taxonomy.js';

/**
 * Build the patch artifact text from a parsed patch map.
 */
export function serializePatch(patchBySlug) {
  return APP_PAGES.map((p) =>
    `=== PATCH: ${p.slug} ===\n${patchBySlug[p.slug] ?? 'no changes'}`
  ).join('\n\n') + '\n';
}

/**
 * Phase 1 (compute, dev). Returns a serialized patch document and per-slug map.
 */
export async function computePatch({
  scopeName, scopeKind, repoName,
  existingPages, unifiedDiff, changedFileContents,
  claudeOpts = {},
}) {
  const built = computePatchPrompt({
    scopeName, scopeKind, repoName,
    existingPages, unifiedDiff, changedFileContents,
  });
  const res = await callClaude(built, claudeOpts);
  const patchBySlug = parsePatchOutput(res.content);
  const patch = serializePatch(patchBySlug);
  const allNoOp = APP_PAGES.every((p) => !patchBySlug[p.slug] || /^no\s+changes\.?$/i.test(patchBySlug[p.slug].trim()));
  return {
    patch, patchBySlug, allNoOp,
    rawResponse: res.content,
    prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`,
    usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs,
  };
}

function isNoChanges(s) {
  return !s || /^no\s+changes\.?$/i.test(s.trim());
}

/**
 * Phase 2 (apply, SDK). Cheap: no source, no diff, only the pages with
 * actual changes are sent. Unchanged pages carry through verbatim.
 */
export async function applyPatch({ scopeName, scopeKind, repoName, existingPages, patchBySlug, claudeOpts = {} }) {
  const slugsToApply = APP_PAGES.map((p) => p.slug).filter((slug) => !isNoChanges(patchBySlug[slug]));
  if (slugsToApply.length === 0) {
    return { pages: {}, rawResponse: '', prompt: '', usage: null, costUsd: 0, durationMs: 0, skipped: true };
  }
  const built = applyPatchPrompt({ scopeName, scopeKind, repoName, existingPages, patchBySlug, slugsToApply });
  const res = await callClaude(built, claudeOpts);
  const pages = parseAppPagesOutput(res.content);
  return {
    pages, slugsToApply, rawResponse: res.content,
    prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`,
    usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs,
  };
}
