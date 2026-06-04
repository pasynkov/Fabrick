import { callClaude } from '../llm/cli.js';
import { discoverTaxonomyPrompt } from '../llm/synthesis-prompts.js';

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

function describeFromBody(body) {
  if (!body) return '(empty)';
  const noFront = body.replace(/^---[\s\S]*?---\n+/, '');
  const lines = noFront.split('\n');
  let inBody = false;
  const buf = [];
  for (const line of lines) {
    const t = line.trim();
    if (!inBody) { if (t.startsWith('# ')) { inBody = true; continue; } continue; }
    if (t.startsWith('#')) break;
    if (!t) { if (buf.length) break; continue; }
    buf.push(t);
  }
  const para = buf.join(' ');
  return para.length > 140 ? para.slice(0, 137) + '...' : para;
}

/**
 * Build per-repo index: { repo: [{slug, desc}] } from wiki bodies.
 */
export function buildPerRepoIndex(perRepoPageBodies) {
  const out = {};
  for (const [repo, pages] of Object.entries(perRepoPageBodies)) {
    out[repo] = [];
    for (const [slug, body] of Object.entries(pages)) {
      if (slug === 'index.md') continue;
      out[repo].push({ slug, desc: describeFromBody(body) });
    }
    out[repo].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  }
  return out;
}

/**
 * Discover stable taxonomy once (typically at iter 0). Returns:
 *   { taxonomy: { pages: [{archSlug, category, title, description, wikiRefs}] }, prompt, rawResponse, costUsd }
 */
export async function discoverTaxonomy({ perRepoPageBodies, claudeOpts = {} }) {
  const perRepoIndex = buildPerRepoIndex(perRepoPageBodies);
  const prompt = discoverTaxonomyPrompt({ perRepoIndex });
  const res = await callClaude(prompt, claudeOpts);
  const json = extractJson(res.content);
  if (!json || !Array.isArray(json.pages)) {
    throw new Error(`taxonomy discovery returned non-JSON: ${res.content.slice(0, 400)}`);
  }
  const taxonomy = { pages: [] };
  for (const p of json.pages) {
    if (!p.archSlug) continue;
    taxonomy.pages.push({
      archSlug: p.archSlug,
      category: p.category ?? deriveCategory(p.archSlug),
      title: p.title ?? deriveTitle(p.archSlug),
      description: p.description ?? '',
      wikiRefs: Array.isArray(p.wikiRefs) ? p.wikiRefs.filter((r) => r.repo && r.slug) : [],
    });
  }
  return { taxonomy, prompt, rawResponse: res.content, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

function deriveCategory(slug) {
  if (slug.includes('/')) return slug.split('/')[0];
  return 'overview';
}

function deriveTitle(slug) {
  const name = slug.replace(/\.md$/, '').split('/').pop();
  return name.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Given wiki diff between iters, return arch slugs that need patching.
 */
export function affectedArchSlugs({ taxonomy, wikiPatchByRepo }) {
  const touchedRefs = new Set();
  for (const [repo, patch] of Object.entries(wikiPatchByRepo)) {
    for (const item of patch.added ?? []) touchedRefs.add(`${repo}::${item.slug ?? item}`);
    for (const item of patch.changed ?? []) touchedRefs.add(`${repo}::${item.slug ?? item}`);
    for (const slug of patch.deleted ?? []) touchedRefs.add(`${repo}::${slug}`);
  }
  const affected = [];
  for (const page of taxonomy.pages) {
    for (const ref of page.wikiRefs ?? []) {
      if (touchedRefs.has(`${ref.repo}::${ref.slug}`)) { affected.push(page); break; }
    }
  }
  return affected;
}

/**
 * Flatten taxonomy: for each arch page, compute the union of source files
 * derived from its wiki refs across ALL contributing repos.
 *
 * Result: page.sources = { repo1: [file, ...], repo2: [file, ...] }
 */
export function flattenArchSources({ taxonomy, perRepoWikiSourcemaps }) {
  const out = { pages: [] };
  for (const page of taxonomy.pages) {
    const sourcesByRepo = {};
    for (const ref of page.wikiRefs ?? []) {
      const repoSmap = perRepoWikiSourcemaps[ref.repo];
      if (!repoSmap) continue;
      const wikiPage = repoSmap.pages?.[ref.slug];
      if (!wikiPage?.files) continue;
      (sourcesByRepo[ref.repo] ??= new Set());
      for (const file of wikiPage.files) sourcesByRepo[ref.repo].add(file);
    }
    const sources = {};
    for (const [repo, set] of Object.entries(sourcesByRepo)) sources[repo] = [...set].sort();
    out.pages.push({ ...page, sources });
  }
  return out;
}

/**
 * File-level invalidation across multiple repos. An arch page is affected if
 * any source file from ANY of its contributing repos appears in that repo's
 * file diff. Bypasses wiki body diff entirely.
 */
export function affectedArchSlugsByFiles({ taxonomy, fileDiffByRepo }) {
  const affected = [];
  const reasons = {};
  for (const page of taxonomy.pages) {
    const hitRepos = [];
    for (const [repo, diff] of Object.entries(fileDiffByRepo)) {
      const pageFiles = new Set(page.sources?.[repo] ?? []);
      if (!pageFiles.size) continue;
      const changed = (diff.added ?? []).concat(diff.changed ?? []).concat(diff.deleted ?? []);
      const intersect = changed.filter((f) => pageFiles.has(f));
      if (intersect.length) hitRepos.push({ repo, files: intersect });
    }
    if (hitRepos.length) {
      affected.push(page);
      reasons[page.archSlug] = hitRepos;
    }
  }
  return { affected, reasons };
}

/**
 * Update taxonomy.wikiRefs: drop deleted refs. Returns updated taxonomy + bookkeeping.
 */
export function pruneTaxonomy({ taxonomy, wikiPatchByRepo }) {
  const dropped = new Set();
  for (const [repo, patch] of Object.entries(wikiPatchByRepo)) {
    for (const slug of patch.deleted ?? []) dropped.add(`${repo}::${slug}`);
  }
  const next = { pages: [] };
  let removedRefs = 0;
  for (const page of taxonomy.pages) {
    const refs = (page.wikiRefs ?? []).filter((r) => !dropped.has(`${r.repo}::${r.slug}`));
    if (refs.length !== (page.wikiRefs?.length ?? 0)) removedRefs++;
    next.pages.push({ ...page, wikiRefs: refs });
  }
  return { taxonomy: next, removedRefsPageCount: removedRefs };
}
