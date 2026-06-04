const FORMAT_HINT = `Return ONLY the markdown content. No code fences, no preamble, no explanation. Do not use any tools.`;

const TAXONOMY_HINT = `Project wiki taxonomy (concept-centric, merge same entities across repos):
- entities/  domain models, data structures, DB schemas, k8s resources
- logic/     business flows, algorithms, processes
- contracts/ API endpoints, request/response schemas, shared interfaces
- transport/ messaging topics/events, queues, gRPC
- config/    environment variables grouped by concern
- overview   system-level overview (single page: slug "overview")`;

/**
 * Phase 1: discover stable project wiki taxonomy.
 * One LLM call. Reads per-repo wiki indexes/summaries. Outputs a fixed list of
 * project-level slugs that the system will maintain across iterations.
 */
export function discoverTaxonomyPrompt({ perRepoIndex }) {
  const repoBlocks = Object.entries(perRepoIndex).map(([repo, items]) => {
    const lines = items.map(({ slug, desc }) => `    ${slug}  —  ${desc}`).join('\n');
    return `--- repo: ${repo} (${items.length} pages) ---\n${lines}`;
  }).join('\n\n');

  return `You are an architect designing the STABLE TAXONOMY for a project-level wiki that synthesizes per-repo wikis from multiple repositories.

PER-REPO WIKI INDEXES (slug — one-line description):
${repoBlocks}

${TAXONOMY_HINT}

INSTRUCTIONS:
- Propose 8–20 stable project pages. Each must aggregate ≥1 wiki page (preferably across repos).
- Prefer CONCEPT-CENTRIC slugs that merge a topic across repos (e.g. "entities/instrument" pulling from backend1 model + kustomize seed migration).
- Use slug format <category>/<name>.md (or "overview.md" without category). Use lowercase kebab-case for names.
- Always include "overview.md" as the system-wide summary.
- Do NOT include "index.md", "mcp-description.md", "mcp-instructions.md" — those are produced by separate mechanical/LLM steps.
- Every project page must be BACKED BY one or more wiki pages. List them as { repo, slug } references.

Output ONLY a single JSON object. No markdown fences, no prose. Shape:
{
  "pages": [
    {
      "archSlug": "overview.md",
      "category": "overview",
      "title": "System Overview",
      "description": "End-to-end summary of all services and infra",
      "wikiRefs": [
        { "repo": "backend1", "slug": "index.md" },
        { "repo": "kustomize", "slug": "index.md" }
      ]
    },
    {
      "archSlug": "entities/instrument.md",
      "category": "entities",
      "title": "Instrument",
      "description": "Financial instrument entity across registry + persistence layers",
      "wikiRefs": [
        { "repo": "backend1", "slug": "entities/Instrument.md" }
      ]
    }
  ]
}
`;
}

/**
 * Per-page generation: write ONE project wiki page.
 */
export function generateArchPagePrompt({ archSlug, title, description, wikiExcerpts }) {
  const blocks = wikiExcerpts.map(({ repo, slug, body }) =>
    `--- WIKI: ${repo}/${slug} ---\n${body}`,
  ).join('\n\n');

  return `You are a software architect writing ONE project-level wiki page by merging the relevant per-repo wiki pages.

ARCH PAGE SLUG: ${archSlug}
TITLE: ${title}
INTENT: ${description}

WIKI PAGES (input from repos):
${blocks}

${TAXONOMY_HINT}

INSTRUCTIONS:
- Write the page about "${title}" only. Focus narrowly on this concept.
- Synthesize across repos: cite cross-repo links (e.g. "backend1/AssetsService → kustomize/Deployment assets-registry").
- Every fact must trace to one of the wiki pages above. Do not invent.
- Sections: # Title, 1–2 paragraph overview, ## Components (bullet list with exact names), ## Cross-repo links (if any), ## Notes (only if needed).
- Concise, factual, no marketing.
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}
`;
}

/**
 * Per-page patch: update one project wiki page given existing body + wiki delta.
 */
export function patchArchPagePrompt({ archSlug, title, description, existingPage, wikiExcerpts, wikiPatchSummary }) {
  const blocks = wikiExcerpts.map(({ repo, slug, body }) =>
    `--- WIKI: ${repo}/${slug} ---\n${body}`,
  ).join('\n\n');

  return `You are updating ONE project wiki page in response to changes in the per-repo wikis it sources from.

ARCH PAGE SLUG: ${archSlug}
TITLE: ${title}
INTENT: ${description}

EXISTING PROJECT PAGE:
---
${existingPage}
---

WHAT CHANGED IN THE SOURCE WIKIS (narrator hint, verify against current bodies below):
${wikiPatchSummary}

CURRENT SOURCE WIKI PAGES (source of truth):
${blocks}

${TAXONOMY_HINT}

INSTRUCTIONS:
- Stay strictly on the topic of "${title}". Do not pull in content that belongs on another arch page.
- The CURRENT SOURCE WIKI PAGES are the source of truth. The EXISTING PAGE may be stale.
- Verify every concrete claim in the existing page against the wikis:
  * Lists of items (services, deployments, endpoints, env vars) — recount from wikis.
  * Counts ("three services", "five deployments") — confirm or update.
  * Named entities (specific service names, deployment names, NATS subjects) — confirm they still exist.
  * Cross-repo links — both ends must be present in wikis.
- If existing says "X" but wikis say "X, Y, Z" — rewrite to include Y and Z.
- DO NOT REMOVE existing factual details that are still accurate. Add new, preserve old.
- If a documented item is no longer in any wiki, remove its mention.
- For sections still accurate, keep wording close to existing to minimize churn.
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}
`;
}

/**
 * Separate step: mcp-description page (tool description for AI agents).
 * Produced once at iter 0, regenerated when taxonomy structurally changes.
 */
export function mcpDescriptionPrompt({ taxonomy, repos }) {
  const cats = {};
  for (const p of taxonomy.pages) (cats[p.category] ??= []).push(p.title);
  const catLines = Object.entries(cats).map(([c, titles]) => `  ${c}: ${titles.length} pages (${titles.slice(0, 5).join(', ')}${titles.length > 5 ? ', …' : ''})`).join('\n');
  const repoLines = repos.map((r) => `  ${r}`).join('\n');

  return `Write a ~200 word tool description for an AI agent that has access to this project wiki via a search tool. Use 2nd person ("you can find...", "ask about...").

REPOS IN THIS PROJECT:
${repoLines}

PROJECT WIKI TAXONOMY:
${catLines}

INSTRUCTIONS:
- ~200 words. No headers, no markdown fences.
- List repos with 1-line purpose each.
- List knowledge categories available (entities, logic, contracts, transport, config).
- Include notable specifics (counts of entities, logic flows, etc.).
- Format as a tool description an agent would read once.

${FORMAT_HINT}
`;
}

/**
 * Separate step: mcp-instructions page (operational guidance for AI agents).
 */
export function mcpInstructionsPrompt({ taxonomy, repos }) {
  return `Write ~80 words of plain text (no markdown headers, no fences) that serve as server-level instructions for an AI agent on when to call the project-wiki search tool \`fabrick_search\`.

REPOS IN THIS PROJECT: ${repos.join(', ')}

REQUIREMENTS:
- State when to call fabrick_search: when working in one layer and needing context from another.
- List the actual layers/apps present (from the repos above) so the agent can match its current context.
- Give 2-3 concrete cross-layer trigger examples grounded in the actual repos.
- Explicitly state NOT to call the tool for questions answerable from local file context.
- Do NOT say "always use this tool".
- Plain text only, no markdown headers.

${FORMAT_HINT}
`;
}
