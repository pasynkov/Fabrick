import { callClaude } from '../llm/cli.js';
import { essenceExtractorPrompt } from '../llm/wiki-prompts.js';

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); }
  catch { return null; }
}

/**
 * Extract structured FEATURES from a per-repo symbol diff via one LLM call.
 *
 * Output:
 *   { features: [{ id, kind, subject, details, affectedPages: [slug, ...] }] }
 */
export async function extractEssence({ diff, sourcemap, repoName, scopeName = repoName, scopeKind = 'root', changedFileContents = {}, unifiedDiff = '', claudeOpts = {} }) {
  const prompt = essenceExtractorPrompt({ diff, sourcemap, repoName, scopeName, scopeKind, changedFileContents, unifiedDiff });
  const res = await callClaude(prompt, claudeOpts);
  const json = extractJson(res.content);
  if (!json || !Array.isArray(json.features)) {
    return { features: [], rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, error: 'json-parse' };
  }
  // Sanity: filter features with no affectedPages
  const features = json.features.filter((f) => f.id && f.subject && Array.isArray(f.affectedPages) && f.affectedPages.length > 0);
  return { features, rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

/**
 * Group essence features by target wiki slug. Useful for fan-out routing.
 *   { slug: [feature, feature, ...] }
 */
export function indexFeaturesBySlug(features) {
  const out = {};
  for (const f of features) {
    for (const slug of f.affectedPages) {
      (out[slug] ??= []).push(f);
    }
  }
  return out;
}
