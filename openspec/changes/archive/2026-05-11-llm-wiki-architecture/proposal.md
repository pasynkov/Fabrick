## Why

Fabrick currently extracts raw context (YAML + MD) from repositories and generates a flat, repo-centric synthesis via full regeneration. Every analysis run re-scans the entire codebase. Synthesis produces static files with no cross-references, no accumulated knowledge, and no concept-level organization. Search is a thin MCP proxy that returns raw files — the user's LLM does all the thinking.

The LLM Wiki pattern (Karpathy, April 2026) shows a better model: compile raw data into a structured, interlinked markdown wiki that an LLM maintains incrementally. Knowledge compounds over time instead of being regenerated from scratch.

Fabrick should adopt this pattern at two levels: a **repo-level wiki** (committed to git, incrementally maintained via file hash tracking) and a **project-level wiki** (server-side, synthesized from repo wikis, with server-side LLM search).

This change supersedes `synthesis-llm-wiki` which proposed only the DB storage part.

## What Changes

### 1. fabrick-analyze → Repo Wiki

**Current**: Scanner (Haiku) extracts raw facts → Synthesis agent (Sonnet) produces YAML/MD context files in `.fabrick/context/`.

**New**: `fabrick scan` CLI command (Node, no LLM) detects changed files via hash comparison. The LLM in the current session reads the changed source files and generates/updates wiki pages in `.fabrick/wiki/` directly. `fabrick rebuild-source-map` CLI command rebuilds metadata after wiki is written. Wiki is committed to git as part of the project.

Key mechanics:
- **Hash map** (`.fabrick/wiki/hashmap.json`): file path → content hash. Built by Node, no LLM. Compared on each run to detect changed/added/deleted files.
- **Source map** (`.fabrick/wiki/source-map.json`): source file → list of wiki page slugs that describe it. Reverse index built from page frontmatter. Used to find which wiki pages need updating when a source file changes.
- **CLI scan**: `fabrick scan` outputs JSON with changed/added/deleted files and affected page slugs. Does NOT write hashmap yet.
- **LLM writes wiki**: The LLM in the active session reads source code files and writes wiki .md files directly. No separate Anthropic SDK call — the LLM IS the generator.
- **CLI rebuild**: `fabrick rebuild-source-map` rebuilds source-map.json from frontmatter and writes new hashmap.json.
- **Incremental update**: only changed source files and their affected wiki pages are read by the LLM. First run = full scan. Subsequent runs = delta only.
- **Taxonomy**: starter set of categories (entities/, logic/, contracts/, transport/, config/) + LLM freedom to add project-specific categories.
- **Page format**: frontmatter (slug, category, sources[], related[], updated) + markdown content + Related Pages section with backlinks.
- **index.md**: TOC with 1-line summary per page. Serves as the navigation map for both humans and LLMs.

### 2. fabrick-synthesis → Project Wiki

**Current**: Concatenates all repo contexts → Claude Sonnet full regeneration → blob storage files.

**New**: Reads repo wikis → incrementally merges into project-level wiki in PostgreSQL. Same source-map approach — if only one repo wiki changed, only affected project pages update.

Project wiki adds cross-repo value:
- Merge same entities across repos (User in repo-A + User in repo-B → unified entity page)
- Discover cross-repo flows (checkout in A → payment in B)
- System-level contracts and integration maps
- Overview and big-picture pages

### 3. fabrick-search → Server-Side LLM Search via MCP

**Current**: MCP exposes two tools (`get_synthesis_index`, `get_synthesis_file`). Agent makes 3-4 calls, reads raw files, reasons over them — spending user's tokens on navigation and comprehension.

**New**: MCP exposes a single `fabrick_search(question)` tool. Internally, MCP calls the Fabrick API search endpoint. The API performs LLM-powered search server-side (reads index → selects pages → formulates answer) and returns a ready answer. One MCP call = one answer.

This is critical for the core use case: an agent coding a frontend task needs to know which backend endpoint returns user data. Agent calls `fabrick_search("what endpoint returns user profile data?")` → gets a direct answer with endpoint path, method, request/response schema. No file navigation, no multi-step reasoning on the user's side.

MCP remains the entry point for agents and humans. The change is where the thinking happens — server-side, not client-side.

## Capabilities

### New Capabilities

- `repo-wiki`: Incremental markdown wiki generated per repository in `.fabrick/wiki/`, committed to git. Node-based hash scanning for change detection, Sonnet for wiki page generation/update. Taxonomy: entities, logic, contracts, transport, config, plus LLM-decided categories.

- `wiki-hash-scanner`: `fabrick scan` CLI command that walks source files, computes content hashes, compares with previous hashmap.json, and outputs flat list of changed/added/deleted file paths to stdout. No LLM, no project structure awareness.

- `wiki-source-map`: `fabrick rebuild-source-map` CLI command. Reads wiki page frontmatter, builds reverse index (source file → page slugs), writes source-map.json + new hashmap.json. Called after LLM finishes writing wiki pages.

- `server-side-search`: Fabrick API endpoint that performs LLM-powered search over the project wiki using the user's API key. Reads index → selects pages → formulates answer → returns result. Exposed to agents via MCP tool `fabrick_search(question)` — single call, single answer.

- `wiki-insights`: Mechanism to save query results back into the project wiki as insights/ pages, enabling knowledge compounding.

### Modified Capabilities

- `fabrick-analyze`: Replaces raw context extraction (YAML/MD in .fabrick/context/) with incremental wiki generation (.fabrick/wiki/). CLI provides two commands: `fabrick scan` (hash diff) and `fabrick rebuild-source-map` (metadata rebuild). The LLM in the active session reads source code and writes wiki pages directly — no separate LLM call needed.

- `fabrick-synthesis`: Moves from full-regeneration blob storage to incremental project wiki in PostgreSQL. Input changes from raw context files to repo wiki pages. Source-map based incrementality.

- `fabrick-search`: MCP changes from two file-navigation tools (`get_synthesis_index` + `get_synthesis_file`) to one `fabrick_search(question)` tool that calls server-side search API. Agent gets a ready answer in one call instead of navigating files in 3-4 calls.

### Removed Capabilities

- `raw-context-extraction`: The .fabrick/context/ YAML+MD format is replaced by .fabrick/wiki/ markdown pages. No more meta.yaml, endpoints.yaml, envs.yaml, etc. as separate files — this information lives in wiki pages organized by concept.

## Impact

- **applications/cli**: New `fabrick scan` command (hash diff, outputs JSON) and `fabrick rebuild-source-map` command (rebuilds metadata after wiki generation). No `fabrick analyze` command — wiki generation happens inside the LLM session via the skill.
- **applications/backend/api**: New wiki page endpoints. Server-side search endpoint using user API keys for LLM calls. Skills zip (`claude-skills.zip`) rebuilt with updated skill definitions.
- **applications/backend/synthesis**: Input changes from raw context to repo wiki pages. Output changes from blob files to DB pages. Incremental logic via source-map.
- **applications/mcp**: Simplified — forwards questions to search API instead of fetching files.
- **Built-in skills** (distributed via `fabrick init` → `GET /skills/claude` → `claude-skills.zip`):
  - **fabrick-analyze skill**: Rewritten. No more Haiku scanner phase. Skill calls `fabrick scan` CLI for hash diff, then the LLM reads source code and writes wiki pages directly, then calls `fabrick rebuild-source-map`. Skill orchestrates the flow; LLM does the thinking.
  - **fabrick-search skill**: Removed. MCP tool `fabrick_search(question)` is self-discoverable by agents — no skill wrapper needed.
  - **fabrick-push skill**: Updated to upload `.fabrick/wiki/` instead of `.fabrick/context/`.
- **applications/console**: ProjectDetail page rewritten — wiki search box, category-grouped page table, markdown page viewer. Uses existing search endpoint and wiki page endpoints.
- **Infrastructure**: No new services. Existing PostgreSQL for project wiki storage.
- **User repos**: New `.fabrick/wiki/` directory committed to git. `.fabrick/context/` becomes obsolete.

### 4. Console — Wiki UI & Interactive Search

**Current**: ProjectDetail page shows synthesis files as collapsible `<details>/<pre>` blocks with plain text.

**New**: Wiki browsing + interactive search:
- **Search box**: text input → calls `POST /search` → renders answer with markdown. Product managers, designers, or any team member can ask questions about the project architecture.
- **Wiki pages table**: category-grouped list from `GET /synthesis/pages`. Click to view.
- **Page viewer**: renders markdown content of a wiki page from `GET /synthesis/file?path=slug`.

## Storage

- **Repo wikis** → uploaded to blob storage (MinIO). Blob is fine for write/read of markdown files.
- **Project wiki** → PostgreSQL. Synthesis reads repo wikis from blob, merges into DB pages. DB enables fast server-side search without reading files per query.

No migration needed — no production data to preserve. Clean cut.

## Monorepos

Application is the atomic unit. Monorepo = multiple wikis, one per app.

```
monorepo/
├── apps/
│   ├── api/
│   │   └── .fabrick/wiki/        ← wiki for api app
│   ├── frontend/
│   │   └── .fabrick/wiki/        ← wiki for frontend app
│   └── worker/
│       └── .fabrick/wiki/        ← wiki for worker app
└── .fabrick/
    └── config.yaml               ← repo-level config
```

`fabrick scan` outputs flat file list. LLM (in skill session) detects monorepo by inspecting file paths and config files (nx.json, turbo.json, etc.). LLM creates wiki per app, runs `fabrick rebuild-source-map --wiki-path` per app. Each app wiki is independent — own hashmap.json, source-map.json, index.md, taxonomy.

Project-level synthesis merges all app wikis (from same or different repos) into one project wiki.

## Open Questions

None currently. Will address limits and edge cases based on production usage.
