import { MigrationInterface, QueryRunner } from 'typeorm';

const MAX_READ_PAGES_BATCH = 6;

const SEARCH_PROMPT = `You are a search agent over a project wiki. The wiki is a curated set of markdown pages organized by category. The project's index page is provided as context.

You can call these tools to explore the wiki:
- list_categories(): list every category in the project.
- list_in(category): list pages in a category as { slug, title, one_liner }.
- page_meta(slug): metadata about a page, including its related[] and sources[] links.
- read_page(slug): full content of one page.
- read_pages(slugs[]): batched content read, at most ${MAX_READ_PAGES_BATCH} slugs per call.
- read_related(slug, depth=1): the related neighborhood of a page, full content.

Strategy hints (not rigid):
- The index is already in context; pick likely entry pages from it before calling tools.
- Prefer reading 1-3 candidate pages first; widen via read_related only if needed.
- Stop calling tools as soon as you have enough context to answer concretely.
- Be parsimonious — do not over-fetch.

Final answer format:
- A single concise paragraph answering the question, prefixed by a line containing only "BRIEF:".
- If reasoning was requested by the caller, follow with a line containing only "REASONING:", then a detailed explanation.
- The very last line MUST be: SOURCES: <slug>, <slug>, ...
  using only the slugs whose content you actually used.

Worked examples:

Example 1 — direct page hit (reasoning not requested):
  Q: "Where do trades land in BigQuery?"
  -> read_page("apps/harvester-reaper")
  -> Answer:
       BRIEF:
       Trades land in the trades table.
       SOURCES: apps/harvester-reaper

Example 2 — multi-hop via read_related (reasoning requested):
  Q: "How does the reaper get triggered?"
  -> read_page("apps/harvester-reaper")
  -> read_related("apps/harvester-reaper", depth=1)
  -> Answer:
       BRIEF:
       The reaper is triggered by the conductor.
       REASONING:
       Details about scheduling, NATS subjects, and conductor handoff.
       SOURCES: apps/harvester-reaper, apps/harvester-conductor
`;

const SYNTHESIS_PROMPT = `You are a software architect synthesizing a project-level wiki from repository wikis.

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

const FABRICK_ANALYZE_SKILL_MD = `---
name: fabrick-analyze
description: Build or update the repo wiki (.fabrick/wiki/). Uses CLI for hash-based
  change detection, then LLM reads source code and generates wiki pages directly.
  Supports monorepos — produces per-app wikis.
---

Analyze the current repository and produce a wiki in \`.fabrick/wiki/\`. Run in the root of the target repository.

---

## Step 1: Scan for changes

\`\`\`bash
npx @fabrick/cli scan
\`\`\`

This outputs JSON to stdout:
\`\`\`json
{
  "mode": "full" | "incremental",
  "changed": ["src/models/user.ts", ...],
  "added": ["src/new-thing.ts", ...],
  "deleted": ["src/old-thing.ts", ...],
  "totalFiles": 342
}
\`\`\`

- If \`mode=full\` and \`totalFiles=0\`: nothing to analyze, stop.
- If \`mode=incremental\` and \`changed=[] added=[] deleted=[]\`: wiki is up to date, stop and report.

---

## Step 2: Detect project structure

Look at the file paths from scan output. Check for monorepo indicators:
- Multiple \`apps/*/\` or \`packages/*/\` directories each with their own \`package.json\`
- \`nx.json\`, \`turbo.json\`, \`lerna.json\`, or \`go.work\` at root
- \`pom.xml\` with \`<modules>\`

**Single app**: wiki goes in \`.fabrick/wiki/\`
**Monorepo**: wiki goes in \`apps/<app-name>/.fabrick/wiki/\` per app

---

## Step 3: Read source files

**Full mode**: read all source files (or representative key files for very large repos)

**Incremental mode**:
1. Read \`.fabrick/wiki/source-map.json\` (or per-app path)
2. Find which wiki pages reference the changed/added files
3. Read only: changed/added source files + affected wiki pages + \`index.md\`

**Skip**: \`node_modules/\`, \`.git/\`, \`.fabrick/\`, \`dist/\`, \`build/\`, \`coverage/\`

---

## Step 4: Generate or update wiki pages

Write \`.md\` files to \`.fabrick/wiki/\` (or per-app path) following this exact format:

\`\`\`markdown
---
slug: entities/user
category: entities
sources:
  - src/models/user.ts
  - src/dto/user.dto.ts
related:
  - entities/order
  - logic/auth-flow
updated: 2026-05-08
---

# User

[markdown content describing this concept]

## Related Pages
- [Order](../entities/order.md) — User has many Orders
- [Auth Flow](../logic/auth-flow.md) — login/register uses User
\`\`\`

**Taxonomy** (starter categories — add custom ones if the codebase warrants):
- \`entities/\` — domain models, data structures, DB schemas
- \`logic/\` — business flows, algorithms, processes
- \`contracts/\` — API endpoints, request/response schemas
- \`transport/\` — messaging topics/events, queues, gRPC
- \`config/\` — environment variables grouped by concern
- Custom categories (e.g. \`middleware/\`, \`auth/\`, \`integrations/\`) if useful

**index.md** (required):
\`\`\`markdown
# Wiki Index

## Entities
- [User](entities/user.md) — Core user model with email auth
- [Order](entities/order.md) — Purchase order with line items

## Logic
- [Auth Flow](logic/auth-flow.md) — Login, register, JWT lifecycle

## Contracts
- [REST API](contracts/rest-api.md) — All HTTP endpoints

...
\`\`\`

**Incremental**: update only affected pages + index.md. Delete pages for removed concepts.

**Monorepo**: create a separate wiki per app. Each wiki is independent with its own taxonomy.

---

## Step 5: Rebuild metadata

For single app:
\`\`\`bash
npx @fabrick/cli rebuild-source-map
\`\`\`

For monorepo (run once per app):
\`\`\`bash
npx @fabrick/cli rebuild-source-map --wiki-path apps/api/.fabrick/wiki
npx @fabrick/cli rebuild-source-map --wiki-path apps/frontend/.fabrick/wiki
\`\`\`

This writes \`source-map.json\` and \`hashmap.json\` to each wiki directory.

---

## Output checklist

- [ ] \`.fabrick/wiki/index.md\` (or per-app)
- [ ] \`.fabrick/wiki/hashmap.json\`
- [ ] \`.fabrick/wiki/source-map.json\`
- [ ] Category directories with \`.md\` pages
- [ ] Each page has valid frontmatter (slug, category, sources, related, updated)
- [ ] Each page has Related Pages section

Report written pages and any that could not be generated.
`;

const FABRICK_ANALYZE_PATTERNS_MD = `# fabrick-analyze: Pattern Library

This file is read by the scanner agent before each analysis run. It contains learned extraction patterns discovered through the improvement loop — project-specific or framework-specific patterns that go beyond standard discovery.

**This file grows through \`fabrick-analyze-loop\`.** Do not edit manually unless adding a well-understood pattern.

## Format

Each entry follows this structure:

\`\`\`markdown
## [Pattern Name]
**Trigger**: condition that indicates this pattern is present in the repo
**Action**: what to do when the trigger matches
**Example**: minimal code snippet showing the pattern
\`\`\`

---

<!-- Patterns added by loop below this line -->
`;

const FABRICK_PUSH_SKILL_MD = `---
name: fabrick-push
description: Upload local .fabrick/wiki/ to the Fabrick backend. Delegates to the
  fabrick CLI. Run after fabrick-analyze has produced wiki pages.
---

Upload the local wiki to Fabrick.

\`\`\`bash
npx @fabrick/cli push
\`\`\`

That's it. The CLI handles auth, compression, and upload.
`;

export class SeedPromptRevisions1748200100000 implements MigrationInterface {
  name = 'SeedPromptRevisions1748200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO prompt_revisions (name, agent, revision, content) VALUES
        ($1, 'claude', 1, $2),
        ($3, 'claude', 1, $4),
        ($5, 'claude', 1, $6),
        ($7, 'claude', 1, $8)
       ON CONFLICT (name, agent, revision) DO NOTHING`,
      [
        'search',
        JSON.stringify({ files: { 'prompt.md': SEARCH_PROMPT } }),
        'synthesis',
        JSON.stringify({ files: { 'prompt.md': SYNTHESIS_PROMPT } }),
        'fabrick-analyze',
        JSON.stringify({ files: { 'SKILL.md': FABRICK_ANALYZE_SKILL_MD, 'patterns.md': FABRICK_ANALYZE_PATTERNS_MD } }),
        'fabrick-push',
        JSON.stringify({ files: { 'SKILL.md': FABRICK_PUSH_SKILL_MD } }),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM prompt_revisions WHERE (name, agent, revision) IN (
        ('search', 'claude', 1),
        ('synthesis', 'claude', 1),
        ('fabrick-analyze', 'claude', 1),
        ('fabrick-push', 'claude', 1)
      )`,
    );
  }
}
