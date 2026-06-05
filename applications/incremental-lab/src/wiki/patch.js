/**
 * Two-phase wiki patch: compute (expensive, dev-side) + apply (cheap, SDK-side).
 *
 * Compute produces a human-readable patch document (audit artifact).
 * Apply runs that patch against existing pages with no source/diff context.
 */

import { callClaude } from '../llm/cli.js';
import { computePatchPrompt, computeSlugPatchPrompt, applyPatchPrompt, parsePatchOutput } from '../llm/patch-prompts.js';
import { parseAppPagesOutput } from '../llm/app-page-prompts.js';
import { APP_PAGES, APP_PAGE_SLUGS } from './app-taxonomy.js';
import { parseUnifiedDiff } from './diff-split.js';
import { routeFileByPath } from './router.js';
import { pMap } from '../util/concurrent.js';

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
  existingPages, unifiedDiff,
  claudeOpts = {},
}) {
  const built = computePatchPrompt({
    scopeName, scopeKind, repoName,
    existingPages, unifiedDiff,
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
 * Phase 1 alternative: per-slug compute. Splits the unified diff by file →
 * routes each file to slugs (via precomputed map or path-only fallback for
 * new files) → calls compute once per slug with only that slug's hunks +
 * that slug's existing page. Smaller prompts, parallelizable.
 *
 * Returns { patchBySlug, perSlugCosts, totalCostUsd, unmappedFiles, prompt, rawResponse, patch }
 * with the same downstream shape as `computePatch`.
 */
export async function computePerSlugPatch({
  scopeName, scopeKind, scopeRoot, repoName,
  existingPages, unifiedDiff, fileSlugMap = {}, rules = {},
  claudeOpts = {}, concurrency = 4,
}) {
  const blocks = parseUnifiedDiff(unifiedDiff);
  const slugHunks = {};
  const unmappedFiles = [];

  for (const block of blocks) {
    const known = fileSlugMap[block.file];
    let slugs = known?.slugs ?? [];
    if (!slugs.length) slugs = routeFileByPath(block.file, rules);
    if (!slugs.length) {
      unmappedFiles.push(block.file);
      continue;
    }
    for (const slug of slugs) (slugHunks[slug] ??= []).push(block.text);
  }

  const slugsWithWork = APP_PAGE_SLUGS.filter((slug) => slugHunks[slug]?.length);
  if (process.env.FABRICK_DEBUG) {
    console.error(`[debug ${scopeName}] blocks=${blocks.length} unmapped=${unmappedFiles.length} slugsWithWork=${slugsWithWork.join(',')}`);
    for (const b of blocks) {
      const known = fileSlugMap[b.file];
      console.error(`  ${b.file} → map=${known?.slugs?.join('|') ?? 'NOT_IN_MAP'}`);
    }
  }
  if (slugsWithWork.length === 0) {
    return {
      patchBySlug: {}, patch: serializePatch({}), allNoOp: true,
      perSlugCosts: {}, costUsd: 0, durationMs: 0,
      prompt: `(no slugs had routed hunks)\nunmapped: ${unmappedFiles.length}`,
      rawResponse: '',
      unmappedFiles,
    };
  }

  const traces = {};
  const perSlugCosts = {};
  const patchBySlug = {};

  const t0 = Date.now();
  await pMap(slugsWithWork, async (slug) => {
    const def = APP_PAGES.find((p) => p.slug === slug);
    const built = computeSlugPatchPrompt({
      scopeName, scopeKind, repoName,
      slug, slugTitle: def?.title ?? slug, slugFocus: def?.focus ?? '',
      existingPage: existingPages[slug],
      slugDiff: slugHunks[slug].join('\n'),
      otherPages: existingPages,
    });
    const res = await callClaude(built, claudeOpts);
    perSlugCosts[slug] = res.costUsd ?? 0;
    traces[slug] = {
      prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`,
      response: res.content,
    };
    // Parse out the single section content
    const parsed = parsePatchOutput(res.content);
    patchBySlug[slug] = parsed[slug] ?? '';
  }, { concurrency });
  const durationMs = Date.now() - t0;

  const totalCostUsd = Object.values(perSlugCosts).reduce((s, c) => s + c, 0);
  const patch = serializePatch(patchBySlug);
  const allNoOp = APP_PAGES.every((p) => isNoChanges(patchBySlug[p.slug]));

  return {
    patchBySlug, patch, allNoOp,
    perSlugCosts, costUsd: totalCostUsd, durationMs,
    prompt: Object.entries(traces).map(([s, t]) => `========== ${s} ==========\n${t.prompt}`).join('\n\n'),
    rawResponse: Object.entries(traces).map(([s, t]) => `========== ${s} ==========\n${t.response}`).join('\n\n'),
    unmappedFiles,
    slugsWithWork,
  };
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
