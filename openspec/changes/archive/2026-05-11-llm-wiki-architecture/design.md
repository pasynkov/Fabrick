## Context

Fabrick extracts raw context from repos (YAML+MD in `.fabrick/context/`), uploads to blob storage, synthesizes into flat repo-centric markdown files, and serves them via MCP for agents to navigate manually. Each analysis re-scans the entire codebase. Each synthesis regenerates all files. Search requires 3-4 MCP calls with the agent reasoning over raw content.

The LLM Wiki pattern replaces this with: incremental repo-level wikis (committed to git) → uploaded to blob → synthesized into a project-level wiki in PostgreSQL → searched server-side via a single MCP call.

Supersedes `synthesis-llm-wiki` change.

## Goals / Non-Goals

**Goals:**
- `fabrick-analyze` skill produces `.fabrick/wiki/` with concept-organized markdown pages (using `fabrick scan` CLI + LLM file writes + `fabrick rebuild-source-map` CLI)
- Hash-based incremental updates — only changed source files trigger wiki page updates
- Wiki committed to git as part of the project
- `fabrick push` uploads `.fabrick/wiki/` to blob storage
- Synthesis worker reads repo wikis from blob, writes project wiki pages to PostgreSQL
- Project wiki synthesis is incremental via source-map
- Server-side LLM search via `POST /search` API endpoint
- MCP exposes single `fabrick_search(question)` tool → calls search API → returns answer
- `fabrick-search` skill removed, `fabrick-analyze` skill orchestrates `fabrick scan` + LLM + `fabrick rebuild-source-map`

**Non-Goals:**
- Vector search or embeddings
- Wiki page versioning or history
- Collaborative editing of wiki pages
- Real-time wiki updates (push-based)

## Design

### 1. Repo Wiki Structure

```
.fabrick/
├── config.yaml                    # existing — repo/project config
└── wiki/
    ├── hashmap.json               # file path → content hash (Node-generated)
    ├── source-map.json            # source file → wiki page slugs (derived from frontmatter)
    ├── index.md                   # TOC + 1-line summary per page
    ├── entities/
    │   └── *.md
    ├── logic/
    │   └── *.md
    ├── contracts/
    │   └── *.md
    ├── transport/
    │   └── *.md
    ├── config/
    │   └── *.md
    └── {llm-decided}/             # LLM can add categories
        └── *.md
```

**Wiki page format:**

```markdown
---
slug: user-entity
category: entities
sources:
  - src/models/user.ts
  - src/dto/user.dto.ts
related:
  - order-entity
  - auth-flow
  - rest-api
updated: 2026-05-08
---

# User

[LLM-generated content]

## Related Pages
- [Order](../entities/order.md) — User has many Orders
- [Auth Flow](../logic/auth-flow.md) — login/register
```

**index.md format:**

```markdown
# Wiki Index

## Entities
- [User](entities/user.md) — Core user model with email auth and org membership
- [Order](entities/order.md) — Purchase order with line items and status tracking

## Logic
- [Auth Flow](logic/auth-flow.md) — Login, register, JWT token lifecycle
- [Checkout](logic/checkout.md) — Cart → payment → order creation

## Contracts
- [REST API](contracts/rest-api.md) — All HTTP endpoints with request/response schemas

## Transport
- [NATS Events](transport/nats-events.md) — Async event bus topics and payloads

## Config
- [Environment](config/environment.md) — All env vars grouped by concern
```

### 2. Hash Scanner (CLI, Node module)

New module in `applications/cli/src/wiki/hash-scanner.ts`.

**`fabrick scan [path]`** — scans from `path` (default: cwd). Pure Node, no LLM, no project structure awareness.

**Process:**
1. Walk all files from path (respect `.gitignore`, skip `node_modules`, `.fabrick/`, `.git/`, `dist/`, `build/`)
2. Compute SHA-256 hash of each file content
3. Build new hashmap: `{ [relativePath]: hash }`
4. Look for previous `.fabrick/wiki/hashmap.json` — if exists, compare:
   - `changed`: paths where hash differs
   - `added`: paths in new but not previous
   - `deleted`: paths in previous but not new
   - If no previous hashmap → all files are `added`, mode = `full`
5. Output JSON to stdout

**Output:**

```typescript
interface ScanResult {
  mode: 'full' | 'incremental';
  changed: string[];    // relative paths
  added: string[];
  deleted: string[];
  totalFiles: number;
}
```

**What scan does NOT do:**
- Does NOT detect monorepo vs single app
- Does NOT decide which files belong to which app
- Does NOT write hashmap (waits for rebuild-source-map)
- Does NOT interact with LLM

The LLM (in the skill session) interprets the file list, decides project structure, and reads the relevant files.

### 3. Source Map

Derived from wiki page frontmatter. Built after each wiki generation run.

**source-map.json:**

```json
{
  "src/models/user.ts": ["entities/user"],
  "src/controllers/order.controller.ts": ["entities/order", "contracts/rest-api", "logic/checkout"],
  "src/config/database.ts": ["config/environment"]
}
```

**Build process:**
1. Read all `.md` files in wiki
2. Parse frontmatter → extract `sources` array
3. Invert: for each source file → collect all page slugs that reference it
4. Write `source-map.json`

### 4. Wiki Generation (Skill + CLI)

Wiki generation happens inside an LLM session (Claude Code). The skill orchestrates, CLI provides tooling.

**CLI commands (pure Node, no LLM):**

- `fabrick scan` — hash scan + diff + affected pages resolution
- `fabrick rebuild-source-map` — rebuild source-map.json + write new hashmap.json

**`fabrick-analyze` skill flow:**

```
fabrick-analyze skill (runs inside LLM session)
      │
      ├── 1. npx @fabrick/cli scan
      │      └── outputs JSON to stdout:
      │          {
      │            "mode": "full" | "incremental",
      │            "changed": ["src/models/user.ts", "apps/api/src/..."],
      │            "added": ["apps/web/src/new.ts"],
      │            "deleted": ["src/old-thing.ts"],
      │            "totalFiles": 342
      │          }
      │          (flat file list — no project structure awareness)
      │
      ├── 2. LLM looks at file paths and decides:
      │      ├── "this is a monorepo — apps/api and apps/web are separate apps"
      │      │   → will create wiki per app: apps/api/.fabrick/wiki/
      │      │                                apps/web/.fabrick/wiki/
      │      ├── OR "single app" → .fabrick/wiki/
      │      │
      │      ├── if mode=full → LLM reads all source files (or key files for large repos)
      │      ├── if mode=incremental:
      │      │   ├── reads source-map.json → resolves affected wiki pages
      │      │   ├── reads changed/added source files
      │      │   ├── reads affected wiki pages
      │      │   └── reads index.md
      │      └── LLM now has full context
      │
      ├── 3. LLM generates/updates wiki pages:
      │      ├── writes .md files to .fabrick/wiki/ with frontmatter
      │      ├── writes/updates index.md
      │      ├── deletes removed pages (if incremental)
      │      └── follows taxonomy: entities/, logic/, contracts/,
      │          transport/, config/, or custom categories
      │
      └── 4. npx @fabrick/cli rebuild-source-map [--wiki-path <path>]
             ├── reads all .md files in specified wiki directory
             ├── parses frontmatter → extracts sources
             ├── builds inverted source-map.json
             └── writes new hashmap.json (re-scans files, stores current hashes)
```

**Key insight:** LLM reads and writes files directly using its own tools (Read, Write, Glob). No JSON parsing of LLM output. No Anthropic SDK in CLI. The LLM IS the wiki generator. The LLM decides project structure — monorepo detection, app boundaries, taxonomy.

**Skill instructions guide the LLM on:**
- Wiki page format (frontmatter fields, Related Pages section)
- Taxonomy starter set
- What to include in each category
- How to write index.md (1-line summaries)
- When to create vs update vs delete pages
- How to detect monorepo (look at file paths: `apps/*/`, `packages/*/`, nx.json, turbo.json)
- For monorepos: create separate wiki per app, run rebuild-source-map per wiki

### 5. Push Changes

`fabrick push` updated to upload `.fabrick/wiki/` instead of `.fabrick/context/`.

**Current:** zips `.fabrick/context/` → POST to `/repos/:repoId/context`

**New:** zips `.fabrick/wiki/` → POST to `/repos/:repoId/context` (same endpoint, different content). Backend stores to blob: `${orgSlug}/${projectSlug}/${repoSlug}/wiki/{entry.path}`.

Storage path changes from `*/context/*` to `*/wiki/*`. API endpoint stays the same.

### 6. Project Wiki Synthesis (Server)

Synthesis worker reads repo wikis from blob, merges into project-level wiki in PostgreSQL.

**New DB table: `wiki_pages`**

```sql
CREATE TABLE wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug VARCHAR NOT NULL,              -- e.g. 'entities/user', 'overview'
  category VARCHAR NOT NULL,          -- e.g. 'entities', 'logic', 'overview'
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  sources TEXT[] NOT NULL DEFAULT '{}', -- source repo slugs
  related TEXT[] NOT NULL DEFAULT '{}', -- related page slugs
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE INDEX idx_wiki_pages_project ON wiki_pages(project_id);
CREATE INDEX idx_wiki_pages_category ON wiki_pages(project_id, category);
```

`sources` here = repo slugs (which repo wikis contributed to this page), not source code files. Used for incremental: if only repo-A wiki changed, find project pages sourced from repo-A.

**Incremental project wiki — full flow:**

```
User runs: fabrick-analyze skill → fabrick push (repo-B)
                                    │
                                    ▼
                        API: POST /repos/:id/context
                        ├── stores repo-B wiki to blob
                        ├── computes hash of uploaded wiki content
                        ├── stores hash: repo_wiki_hashes[repo-B] = "abc123"
                        ├── compares with previous hash for repo-B
                        │   └── if same → skip synthesis, done
                        │   └── if different → trigger synthesis
                        └── publishes synthesis job to queue
                                    │
                                    ▼
                        Synthesis Worker receives job
                        ├── job contains: { projectId, repos: [A, B, C], changedRepos: ["B"] }
                        │
                        ├── 1. Load repo wikis from blob:
                        │      ├── repo-B: ALL pages (changed repo — full content needed)
                        │      ├── repo-A: only index.md (unchanged — for cross-ref context)
                        │      └── repo-C: only index.md (unchanged — for cross-ref context)
                        │
                        ├── 2. Load existing project wiki from DB:
                        │      └── GET /internal/synthesis/pages?projectId=...
                        │          returns all project wiki pages with content
                        │
                        ├── 3. Determine mode:
                        │      ├── no existing pages → FULL mode (all repo wikis fully loaded)
                        │      └── existing pages present → INCREMENTAL mode
                        │
                        ├── 4. Build LLM prompt:
                        │      │
                        │      ├── FULL MODE:
                        │      │   "Generate project wiki from scratch."
                        │      │   Input: all repo wiki pages (full content)
                        │      │   Output: all project pages
                        │      │
                        │      └── INCREMENTAL MODE:
                        │          "Update project wiki. Repo-B changed."
                        │          Input:
                        │            ├── changed repo wiki (repo-B): full pages
                        │            ├── unchanged repos: index.md only (for context)
                        │            ├── existing project pages (all — LLM needs full picture)
                        │            └── instruction: update pages sourced from repo-B,
                        │                create new cross-repo pages if needed,
                        │                delete pages whose source content is gone
                        │          Output: only changed/new pages + DELETE markers
                        │
                        ├── 5. Parse LLM response:
                        │      ├── split by === PAGE: slug === delimiter
                        │      ├── parse frontmatter from each page
                        │      ├── collect === DELETE: slug === markers
                        │      └── build pages array + deletions list
                        │
                        ├── 6. Apply changes:
                        │      ├── PUT /internal/synthesis/pages (upsert changed pages)
                        │      └── DELETE /internal/synthesis/pages (delete marked pages)
                        │
                        └── 7. Callback: status done
```

**How "changed repos" is determined:**

New DB table or column to track repo wiki content hashes:

```sql
-- Option A: column on repositories table
ALTER TABLE repositories ADD COLUMN wiki_content_hash VARCHAR(64);

-- Option B: separate lightweight table
CREATE TABLE repo_wiki_hashes (
  repo_id UUID PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

Push endpoint flow:
1. Receive wiki zip → store to blob
2. Compute SHA-256 of zip content (or concatenated wiki files)
3. Compare with stored hash for this repo
4. If hash unchanged → respond 200, skip synthesis
5. If hash changed → update stored hash, include repo in `changedRepos` when triggering synthesis

**Synthesis job message (updated):**

```typescript
interface SynthesisJob {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  repos: { id: string; slug: string }[];
  changedRepos: string[];           // NEW: repo slugs that actually changed
  callbackToken: string;
  anthropicApiKey: string;
}
```

**What the worker sends to LLM (incremental example):**

```
You are updating a project-level wiki. Repository "backend" was updated.

## Changed repo wikis (full content):

=== REPO: backend ===
[all backend wiki pages — full content]

## Unchanged repo wikis (index only, for cross-reference):

=== REPO-INDEX: frontend ===
[frontend index.md only]

=== REPO-INDEX: worker ===
[worker index.md only]

## Existing project wiki pages:

=== EXISTING: entities/user ===
---
slug: entities/user
sources: [backend, frontend]
---
[current content]

=== EXISTING: logic/checkout ===
---
slug: logic/checkout
sources: [backend]
---
[current content]

[... all existing pages ...]

## Instructions:
- Update project pages that are sourced from "backend"
- Check if changes in "backend" create new cross-repo connections
- Preserve pages not affected by "backend" changes (do not output them)
- If a concept was removed from "backend", update or delete the project page
- Always output updated index page
- Use === DELETE: slug === for pages to remove

## Output format:
=== PAGE: slug ===
---
frontmatter
---
content

=== DELETE: slug ===
```

**New internal API endpoints:**

```
GET  /internal/synthesis/pages?projectId=...     → returns existing project wiki pages
PUT  /internal/synthesis/pages                    → upserts pages array
     Body: { projectId, callbackToken, pages: [{ slug, category, title, content, sources, related }] }
     Auth: callbackToken (JWT with scope='synth-callback')
```

**Synthesis prompt (project level):**

```
You are synthesizing a project-level wiki from multiple repository wikis.

Repo wikis:
=== REPO: backend ===
{all pages from backend wiki}

=== REPO: frontend ===
{all pages from frontend wiki}

Existing project wiki pages (if any):
{existing pages for incremental update}

Instructions:
- Merge entities that appear in multiple repos into unified pages
- Discover cross-repo flows (e.g. frontend calls backend endpoint)
- Create system-level overview and integration maps
- Maintain category taxonomy: entities/, logic/, contracts/, transport/, config/, overview
- Track which repos contributed to each page in sources[]
- Always include an index page listing all pages with 1-line summaries

Output format — one section per page, separated by delimiters:

=== PAGE: entities/user ===
---
slug: entities/user
category: entities
title: User
sources: [backend, frontend]
related: [entities/order, logic/auth-flow]
---

[markdown content here]

=== PAGE: index ===
---
slug: index
category: index
title: Wiki Index
sources: [backend, frontend]
related: []
---

[index content with links and summaries]
```

### 7. Server-Side Search

New endpoint in API.

**`POST /orgs/:orgSlug/projects/:projectSlug/search`**

```typescript
// Request
{ question: string }

// Response
{ answer: string, sources: string[] }  // sources = page slugs used
```

**Auth:** `FabrickAuthGuard` (same as existing endpoints). MCP token has org+project claims.

**Flow:**

1. Resolve Anthropic API key (project → org fallback, same as synthesis trigger)
2. Load project wiki index page from DB (`slug = 'index'`)
3. LLM call #1: given index + question → select relevant page slugs
4. Load selected pages from DB
5. LLM call #2: given pages + question → formulate answer
6. Return answer + source page slugs

**LLM calls use user's Anthropic API key** (from project/org settings). Fabrick doesn't pay for search — the user does.

Model: `claude-sonnet-4-20250514` (same as wiki generation).

### 8. MCP Changes

**Remove:**
- `get_synthesis_index` tool
- `get_synthesis_file` tool

**Add:**
- `fabrick_search` tool with **dynamic description**

**Dynamic tool description:**

MCP server fetches a pre-generated summary from the API at startup. This summary is created by the synthesis worker as a special `mcp-description` page — a condensed (~200 word) description of what knowledge is available in the project wiki. The tool description tells the agent WHAT it can find, not just that search exists.

```typescript
// On MCP server init:
const description = await getToolDescription(apiUrl, org, project, token);

server.tool(
  'fabrick_search',
  description,  // dynamic, project-specific
  { question: z.string().describe('Your question about the project') },
  async ({ question }) => {
    const result = await searchProject(apiUrl, org, project, question, token);
    return { content: [{ type: 'text', text: result.answer }] };
  },
);
```

**getToolDescription flow:**

```typescript
async function getToolDescription(apiUrl, org, project, token): Promise<string> {
  try {
    const desc = await getSynthesisFile(apiUrl, org, project, 'mcp-description', token);
    return desc;  // pre-generated by synthesis worker
  } catch {
    // Fallback if no synthesis yet
    return 'Search the project knowledge base. Ask any question about architecture, APIs, entities, flows, configuration.';
  }
}
```

**`mcp-description` page — generated by synthesis worker:**

The synthesis prompt instructs the LLM to generate a special page with slug `mcp-description` that:
- Lists all repos/apps in the project with 1-line purpose
- Summarizes available knowledge categories (entities, endpoints, flows, etc.)
- Mentions specific notable things (e.g. "REST API with 15 endpoints", "NATS event bus with 3 topics")
- Is written as a tool description (2nd person: "you can find...", "ask about...")
- Max ~200 words — fits in MCP tool description without bloating context

Example output:

```
Search the Fabrick project knowledge base.

Available repos:
- backend/api (NestJS) — REST API for context upload, synthesis trigger, org/project management
- backend/synthesis (NestJS) — synthesis worker, queue consumer, LLM-powered wiki generation
- mcp (Node) — MCP server exposing search to coding agents
- cli (NestJS CLI) — init, push, scan commands

You can ask about:
- API endpoints (15 REST endpoints across auth, repos, orgs, projects, synthesis)
- Entities (User, Organization, Project, Repository, WikiPage)
- Flows (context upload → synthesis → wiki generation, auth/login, MCP search)
- Transport (NATS/Service Bus queues, synthesis job messages)
- Configuration (env vars for MinIO, PostgreSQL, Azure services)
- Cross-repo integrations (CLI → API → Worker → API callback)
```

**MCP api-client.ts — new functions:**

```typescript
export async function searchProject(
  apiUrl: string, org: string, project: string,
  question: string, token: string,
): Promise<{ answer: string; sources: string[] }> {
  const url = `${apiUrl}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  return res.json();
}

export async function getToolDescription(
  apiUrl: string, org: string, project: string, token: string,
): Promise<string> {
  return getSynthesisFile(apiUrl, org, project, 'mcp-description', token);
}
```

### 9. Console — Wiki UI

`applications/console/src/pages/ProjectDetail.tsx` — rewrite synthesis section.

**Three new components:**

**WikiSearch** — interactive Q&A for non-technical team members:

```typescript
// components/WikiSearch.tsx
// - Text input + submit button
// - Calls POST /orgs/:org/projects/:project/search { question }
// - Displays answer as rendered markdown (use react-markdown or similar)
// - Shows source page slugs as clickable links
// - Loading state while waiting for LLM response (can be 3-5s)
// - Disabled with message if synthesis hasn't run yet
```

**WikiPagesTable** — category-grouped page browser:

```typescript
// components/WikiPagesTable.tsx
// - Fetches GET /orgs/:org/projects/:project/synthesis/pages
//   → { pages: [{ slug, category, title, sources, updated_at }] }
// - Groups by category, renders as table/list
// - Each page title is a link → opens WikiPageView
// - Shows last updated timestamp
// - Empty state if no synthesis yet
```

**WikiPageView** — renders a single wiki page:

```typescript
// components/WikiPageView.tsx
// - Fetches GET /orgs/:org/projects/:project/synthesis/file?path=slug
// - Renders markdown content (react-markdown + remark-gfm for tables)
// - Back button to return to pages table
// - Related Pages section links are clickable → navigate to other pages
```

**Route change:**

```
// Existing:
/orgs/:orgSlug/projects/:projectSlug          → ProjectDetail

// New (or within ProjectDetail as tabs/sections):
/orgs/:orgSlug/projects/:projectSlug/wiki/:slug  → WikiPageView
```

**Dependency:** Add `react-markdown` + `remark-gfm` to console package.json for markdown rendering.

### 10. Skills Changes


Skills are packaged in `applications/backend/api/src/assets/claude-skills.zip` and distributed via `GET /skills/claude` during `fabrick init`.

**fabrick-analyze skill — rewritten:**

The skill runs inside the LLM session. It uses CLI for hash scanning, then the LLM itself reads code and writes wiki pages.

```markdown
---
name: fabrick-analyze
description: Build or update the repo wiki (.fabrick/wiki/). Uses CLI for
  hash-based change detection, then LLM reads source code and generates
  wiki pages directly.
---

## Step 1: Scan for changes

Run:
\`\`\`bash
npx @fabrick/cli scan
\`\`\`

This outputs JSON with mode (full/incremental), changed/added/deleted files,
and affected wiki pages.

## Step 2: Read source files

- If mode=full: read all source files listed in scan output
- If mode=incremental: read changed/added files + affected wiki pages
  from .fabrick/wiki/ + .fabrick/wiki/index.md
- If no changes detected: stop, report "wiki is up to date"

## Step 3: Generate/update wiki pages

Write .md files to .fabrick/wiki/ following this format:
[frontmatter spec, taxonomy rules, page structure guidelines]

## Step 4: Rebuild metadata

Run:
\`\`\`bash
npx @fabrick/cli rebuild-source-map
\`\`\`
```

**fabrick-search skill — removed** from the zip. MCP tool `fabrick_search` is self-discoverable.

**fabrick-push skill — updated** to reference `.fabrick/wiki/` instead of `.fabrick/context/`.

### 11. Monorepo Handling

LLM detects monorepo by inspecting file paths from `fabrick scan` output (e.g. `apps/api/src/...`, `packages/web/...`) and looking for config files (nx.json, turbo.json, lerna.json). CLI has no monorepo awareness.

LLM creates wiki per app:

```
monorepo/
├── apps/
│   ├── api/.fabrick/wiki/           # independent wiki
│   ├── frontend/.fabrick/wiki/      # independent wiki
│   └── worker/.fabrick/wiki/        # independent wiki
└── .fabrick/config.yaml
```

LLM runs `fabrick rebuild-source-map --wiki-path apps/api/.fabrick/wiki` per app after writing pages.

`fabrick push` zips all app wikis:

```
wiki/
├── api/                             # mapped from apps/api/.fabrick/wiki/
│   ├── index.md
│   ├── hashmap.json
│   └── ...
├── frontend/
│   ├── index.md
│   └── ...
└── worker/
    ├── index.md
    └── ...
```

Each app wiki is treated as an independent repo wiki by synthesis.

## Decisions

### Decision: Hash-based change detection over git diff

Git diff requires knowing the base commit. Hash map is self-contained — works without git, works from any state, deterministic. Hash computation is fast (SHA-256 of file content). Trade-off: stores hashmap.json in repo (small file).

### Decision: Source map as derived data, not LLM-maintained

Source map is rebuilt from page frontmatter after every run. LLM only maintains `sources` in each page's frontmatter. This avoids drift between source-map.json and actual page content.

### Decision: LLM writes wiki files directly (repo) / delimiter format (project)

For repo-level wiki: the LLM in the current session reads source code and writes .md files directly using its file tools (Read, Write). No parsing needed. The LLM IS the wiki generator.

For project-level wiki (synthesis worker): LLM outputs pages using delimiter format (`=== PAGE: slug ===`) same as current `=== FILE: ===` pattern. JSON breaks too often with LLM output. Metadata (category, sources, related) is embedded in page frontmatter — worker parses frontmatter after splitting by delimiter.

### Decision: Two LLM calls for search, not one

Call #1 selects relevant pages (cheap — only reads index). Call #2 formulates answer (reads full pages). This avoids sending all pages to the LLM for every query. For a project with 30 pages averaging 2K words each, that's 60K words — too much for every query. Index scan + selective read is more efficient.

### Decision: User's API key for search, not Fabrick's

Search uses the user's Anthropic API key (already stored for synthesis). Fabrick doesn't subsidize search costs. This is consistent with synthesis billing model.

### Decision: wiki_pages table, not blob storage for project wiki

Project wiki needs fast reads for search (multiple pages per query). DB is better than blob for this. Repo wikis stay in blob — they're write-once-read-once (during synthesis).

### Decision: fabrick-analyze skill orchestrates CLI scan + LLM file writes

Current skill orchestrates Haiku scanner agent + Sonnet synthesis agent directly. New skill calls `fabrick scan` CLI for hash diff, then the LLM in the current session reads code and writes wiki pages, then calls `fabrick rebuild-source-map`. Benefits: LLM reads actual code (better understanding), no separate Anthropic SDK call needed, incremental by default.

## Risks / Trade-offs

- **First full wiki generation is expensive** — reads all source files, generates all pages. For large repos this could be a long LLM call. Acceptable: happens once, incremental after that.
- **LLM may produce inconsistent taxonomy** — "is checkout a flow or a service?" Mitigated by starter categories in prompt. Acceptable: index navigation works regardless.
- **LLM delimiter output parsing** — same approach as current synthesis. Delimiter format is more robust than JSON for LLM output. Frontmatter parsing well-understood.
- **hashmap.json + source-map.json add files to git** — small files, useful for debugging. Acceptable.
- **Search latency: two LLM calls** — could be 3-5 seconds total. Acceptable for the use case (developer asking architectural questions, not real-time).
