const FORMAT_HINT = `Return ONLY the markdown content. No fences, no preamble. Do not use any tools.`;

/**
 * Production synthesis prompt, taken from
 * applications/backend/api/src/migrations/1748200100000-SeedPromptRevisions.ts
 * (Anthropic / Fabrick canonical synthesis policy).
 *
 * Input format expected from the caller (single user message):
 *   === REPO: <name> ===   { full content of all wiki pages in repo, each preceded by its slug }
 *   === REPO-INDEX: <name> ===   { index.md content only, for repos with no changes }
 *   === EXISTING: <slug> ===   { existing project wiki page, full markdown body }
 *
 * Output format produced by the model:
 *   === PAGE: <slug> ===
 *   ---
 *   slug: ...
 *   category: ...
 *   sources: [...repos...]
 *   ---
 *   <markdown content>
 *
 *   === DELETE: <slug> ===     (incremental mode only)
 */
export const SYNTHESIS_PROMPT = `You are a software architect synthesizing a project-level wiki from repository wikis.

## Your task

Merge wiki pages from one or more repositories into a unified, concept-centric project wiki. Organize knowledge by concept, not by repository.

## Input format

Repository wikis are provided in this format:

=== REPO: {repo-name} ===
{all wiki pages from that repo, each with frontmatter and content}

=== REPO-INDEX: {repo-name} ===
{index.md content only — for unchanged repos in incremental mode}

=== EXISTING: {slug} ===
{existing project wiki page — for incremental mode}

## Instructions

- Merge same entities that appear in multiple repos into unified pages
- Discover cross-repo flows (e.g. frontend calls backend endpoint)
- Create system-level overview and integration maps
- Track which repos contributed to each page in sources[] (use repo slugs, not file paths)
- Always output an index page listing all pages with 1-line summaries, grouped by category
- Always output an mcp-description page (see below)
- Add Related Pages section at the bottom of each page (except index and mcp-description)

## Taxonomy (starter categories — add custom ones if warranted)

- entities/ — domain models, data structures, database schemas
- logic/ — business flows, algorithms, processes
- contracts/ — API endpoints, request/response schemas, shared interfaces
- transport/ — messaging topics/events, gRPC services, WebSocket channels
- config/ — environment variables grouped by concern
- overview — system-level summary and architecture description

## mcp-description page

Generate a page with slug "mcp-description" containing ~200 words describing what knowledge is available. Format as a tool description (2nd person: "you can find...", "ask about..."). Include:
- List of all repos/apps with 1-line purpose each
- Knowledge categories available (entities, endpoints, flows, transport, config)
- Notable specifics (e.g. "15 REST endpoints", "3 NATS topics")

## mcp-instructions page

Generate a page with slug "mcp-instructions" containing ~80 words of plain text (no markdown headers). This text is used as server-level instructions for the AI agent. It must:
- State when to call \`fabrick_search\`: when working in one layer and needing context from another
- List the actual layers/apps present in the project (e.g. "frontend", "backend", "infra") so the agent can match its current context
- Give 2-3 concrete cross-layer trigger examples based only on layers that exist
- Explicitly state NOT to call the tool for questions answerable from local file context
- Do NOT say "always use this tool"

## Output format

Output ONLY page sections — no explanation, no JSON, no code blocks wrapping the whole response.

Each page:

=== PAGE: {slug} ===
---
slug: {slug}
category: {category}
title: {title}
sources: [{repo-slug1}, {repo-slug2}]
related: [{slug1}, {slug2}]
---

{markdown content}

## Related Pages
- [{Title}]({slug}) — {relationship description}

IMPORTANT: All internal links (index page entries, Related Pages) MUST use the slug as the path — no \`.md\` extension. Example: \`(apps/harvester-conductor)\` not \`(apps/harvester-conductor.md)\`.

To delete a page (incremental mode only):

=== DELETE: {slug} ===

## Incremental mode instructions

When existing project pages are provided:
- Update ONLY pages sourced from changed repos
- Create new pages if new concepts appeared
- Mark pages for deletion with === DELETE: slug === if source content was removed
- Always output updated index and mcp-description pages
- DO NOT output unchanged pages (they will be preserved as-is)
`;

/**
 * Build the user input block for synthesis (full mode).
 *
 * @param {Object[]} repos          [{ name, pages: { slug: body } }]
 */
export function buildSynthesisFullInput({ repos }) {
  const blocks = repos.map(({ name, pages }) => {
    const ordered = Object.entries(pages).sort(([a], [b]) => (a < b ? -1 : 1));
    const inner = ordered.map(([slug, body]) => `[${slug}]\n${body}`).join('\n\n');
    return `=== REPO: ${name} ===\n${inner}`;
  });
  return blocks.join('\n\n');
}

/**
 * Build the user input block for synthesis (incremental mode).
 *
 * @param {Object} args
 * @param {Object[]} args.changedRepos      [{ name, pages }] — full content of changed-repo wikis
 * @param {Object[]} args.unchangedRepos    [{ name, indexBody }] — index.md only
 * @param {Object[]} args.existingPages     [{ slug, body }] — current project wiki pages
 */
export function buildSynthesisIncrementalInput({ changedRepos, unchangedRepos, existingPages }) {
  const out = [];
  for (const { name, pages } of changedRepos) {
    const ordered = Object.entries(pages).sort(([a], [b]) => (a < b ? -1 : 1));
    out.push(`=== REPO: ${name} ===\n${ordered.map(([slug, body]) => `[${slug}]\n${body}`).join('\n\n')}`);
  }
  for (const { name, indexBody } of unchangedRepos) {
    out.push(`=== REPO-INDEX: ${name} ===\n${indexBody}`);
  }
  for (const { slug, body } of existingPages) {
    out.push(`=== EXISTING: ${slug} ===\n${body}`);
  }
  return out.join('\n\n');
}

/**
 * Parse the model's output into pages and deletions.
 * Format:
 *   === PAGE: <slug> ===
 *   <body until next === or EOF>
 *   === DELETE: <slug> ===
 */
export function parseSynthesisOutput(raw) {
  const pages = [];
  const deletions = [];
  if (!raw) return { pages, deletions };
  const re = /===\s*(PAGE|DELETE):\s*([^\s=]+)\s*===\s*\n?/g;
  const tokens = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    tokens.push({ kind: m[1], slug: m[2], start: m.index, contentStart: re.lastIndex });
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const body = raw.slice(t.contentStart, next ? next.start : raw.length).trim();
    if (t.kind === 'PAGE') pages.push({ slug: t.slug, body });
    else deletions.push(t.slug);
  }
  return { pages, deletions };
}
