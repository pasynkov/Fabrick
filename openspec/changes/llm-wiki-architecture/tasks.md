## 1. CLI — Hash Scanner Module

- [ ] 1.1 Create `applications/cli/src/wiki/hash-scanner.ts` — walks source files, computes SHA-256 hashes, returns `HashScanResult { changed, added, deleted, hashmap }`
- [ ] 1.2 Implement ignore rules: `.gitignore` patterns, `node_modules/`, `.fabrick/`, `.git/`, `dist/`, `build/`, `coverage/`
- [ ] 1.3 Implement diff logic: compare new hashmap with previous `hashmap.json`, classify files as changed/added/deleted
- [ ] 1.4 Create `applications/cli/src/wiki/source-map.ts` — reads all wiki `.md` files, parses frontmatter `sources`, builds inverted index, writes `source-map.json`
- [ ] 1.5 Create `applications/cli/src/wiki/affected-pages.ts` — given `HashScanResult` + `source-map.json`, returns set of affected page slugs
- [ ] 1.6 Add tests for hash scanner (mock filesystem, verify changed/added/deleted classification)
- [ ] 1.7 Add tests for source map builder (verify inversion logic)

## 2. CLI — Scan Command

- [ ] 2.1 Create `fabrick scan` command in `applications/cli/src/scan.command.ts`
- [ ] 2.2 Walk all files from cwd (or `[path]` arg), respect `.gitignore`, skip `node_modules/`, `.fabrick/`, `.git/`, `dist/`, `build/`
- [ ] 2.3 Compute SHA-256 hash of each file content
- [ ] 2.4 Load previous `.fabrick/wiki/hashmap.json` (if exists), compare hashes → classify changed/added/deleted
- [ ] 2.5 Output JSON to stdout: `{ mode, changed, added, deleted, totalFiles }` — flat file list, no project structure awareness
- [ ] 2.6 Add `--full` flag to force full mode even if hashmap exists
- [ ] 2.7 Do NOT write hashmap — that's rebuild-source-map's job
- [ ] 2.8 No monorepo detection, no affected pages resolution — LLM handles both using source-map.json and file paths

## 3. CLI — Rebuild Source Map Command

- [ ] 3.1 Create `fabrick rebuild-source-map` command in `applications/cli/src/rebuild-source-map.command.ts`
- [ ] 3.2 Accept `--wiki-path <path>` flag (default: `.fabrick/wiki/`) — needed for monorepo per-app rebuild
- [ ] 3.3 Read all `.md` files in wiki path, parse YAML frontmatter, extract `sources` arrays
- [ ] 3.4 Build inverted source-map.json (source file → page slugs)
- [ ] 3.5 Re-scan source files and write new hashmap.json to wiki path

## 4. CLI — Push Command

- [ ] 4.1 Update `fabrick push` to zip `.fabrick/wiki/` instead of `.fabrick/context/`
- [ ] 4.2 For monorepos: zip all app wikis into single archive with `wiki/<app-name>/` structure
- [ ] 4.3 Update storage path on API side: `${orgSlug}/${projectSlug}/${repoSlug}/wiki/` instead of `*/context/`
- [ ] 4.4 API push endpoint: compute SHA-256 hash of uploaded wiki content, compare with stored `wiki_content_hash` on repo, skip synthesis if unchanged
- [ ] 4.5 API push endpoint: when triggering synthesis, pass `changedRepos` (only repos with new hash) in synthesis job message

## 5. Database

- [ ] 5.1 Create `WikiPage` TypeORM entity (`applications/backend/api/src/entities/wiki-page.entity.ts`) with fields: id, project_id FK, slug, category, title, content, sources (text[]), related (text[]), updated_at; UNIQUE(project_id, slug)
- [ ] 5.2 Add `wiki_content_hash` column (varchar(64), nullable) to `repositories` table — tracks hash of last uploaded wiki content
- [ ] 5.3 Create migration `1746700000000-AddWikiPages.ts` — wiki_pages table + wiki_content_hash column
- [ ] 5.4 Register WikiPage entity in AppModule and SynthesisModule

## 6. API — Internal Wiki Page Endpoints

- [ ] 6.1 Add `PUT /internal/synthesis/pages` to SynthesisController — accepts `{ projectId, pages[] }`, validates callbackToken (scope: synth-callback, sub === projectId), upserts all pages
- [ ] 6.2 Add `GET /internal/synthesis/pages?projectId=...` — returns all wiki_pages with content for a project, validated by callbackToken
- [ ] 6.3 Implement upsert in SynthesisService: INSERT ... ON CONFLICT (project_id, slug) DO UPDATE SET content, category, title, sources, related, updated_at
- [ ] 6.4 Add `DELETE /internal/synthesis/pages` — accepts `{ projectId, slugs: string[] }`, deletes pages by slug. Protected by callbackToken.
- [ ] 6.5 Add request DTOs with validation

## 7. API — Public Read Endpoint

- [ ] 7.1 Update `getSynthesisFileBySlug` to query `wiki_pages WHERE project_id = ? AND slug = ?` instead of blob storage
- [ ] 7.2 Return 404 if slug not found

## 8. API — Search Endpoint

- [ ] 8.1 Create `SearchService` in `applications/backend/api/src/search/`
- [ ] 8.2 Add `POST /orgs/:org/projects/:project/search` route accepting `{ question }`, protected by FabrickAuthGuard
- [ ] 8.3 Implement two-step LLM flow: load index page → LLM selects relevant slugs → load selected pages → LLM formulates answer
- [ ] 8.4 Resolve Anthropic API key via existing ApiKeyResolutionService (project → org fallback), return 400 if none configured
- [ ] 8.5 Return `{ answer, sources }` — sources = page slugs used
- [ ] 8.6 Add search module registration in AppModule

## 9. Synthesis Worker — Wiki Input & Prompt

- [ ] 9.1 Update worker to load repo wiki files from blob (`*/wiki/**/*.md`) instead of raw context files (`*/context/*`)
- [ ] 9.2 Update worker to load existing project wiki pages from API (`GET /internal/synthesis/pages`)
- [ ] 9.3 Write new synthesis prompt — concept-centric wiki generation + mcp-description page:
  - Input format: repo wiki pages grouped by repo (`=== REPO: name ===`) + existing project pages (if any)
  - Output format: delimiter `=== PAGE: slug ===` with YAML frontmatter (slug, category, title, sources[], related[])
  - Instructions: merge same entities across repos, discover cross-repo flows, create system overview, build integration maps
  - Taxonomy: entities/, logic/, contracts/, transport/, config/, overview + LLM freedom for custom categories
  - Always output index page with TOC + 1-line summary per page
  - Related Pages section with backlinks at bottom of each page
  - Always output `mcp-description` page: ~200 word summary of available knowledge, written as MCP tool description (2nd person), lists repos, knowledge categories, notable specifics
- [ ] 9.4 Write incremental synthesis prompt — update existing project wiki:
  - Input: existing project wiki pages + changed repo wiki pages (only repos that were re-analyzed)
  - Instructions: update only pages affected by changed repo wikis, create new pages if new concepts appeared, delete pages whose source repos removed the relevant content
  - Track which repos contributed via `sources[]` in frontmatter — use this to scope updates
- [ ] 9.5 Implement incremental mode in worker: if `changedRepos` present and existing project pages exist → load changed repos fully, unchanged repos index-only, build incremental prompt
- [ ] 9.5.1 Implement DELETE marker parsing: `=== DELETE: slug ===` → delete from wiki_pages
- [ ] 9.6 Update response parser: split by `=== PAGE: ` delimiter, parse YAML frontmatter from each page, extract slug/category/title/sources/related + content
- [ ] 9.7 Replace blob output write with `PUT /internal/synthesis/pages` call
- [ ] 9.8 Handle malformed output with error callback

## 10. MCP — Search Tool

- [ ] 10.1 Remove `get_synthesis_index` tool
- [ ] 10.2 Remove `get_synthesis_file` tool
- [ ] 10.3 Add `fabrick_search` tool with dynamic description: fetch `mcp-description` page from API at startup, use as tool description. Fallback to generic description if not available.
- [ ] 10.4 Add `searchProject` function to `api-client.ts`
- [ ] 10.5 Add `getToolDescription` function to `api-client.ts` — fetches `mcp-description` page
- [ ] 10.6 Remove `getSynthesisIndex` and `getSynthesisFile` from `api-client.ts`

## 11. Console — Wiki UI

- [ ] 11.1 Add `react-markdown` + `remark-gfm` dependencies to `applications/console/package.json`
- [ ] 11.2 Create `WikiSearch` component: text input + submit → `POST /orgs/:org/projects/:project/search` → render answer as markdown, show source page links, loading state
- [ ] 11.3 Create `WikiPagesTable` component: fetch `GET /synthesis/pages` → group by category → render table with clickable page titles, show updated_at
- [ ] 11.4 Create `WikiPageView` component: fetch page by slug → render markdown → Related Pages links clickable → back button
- [ ] 11.5 Add route `/orgs/:orgSlug/projects/:projectSlug/wiki/:slug*` for WikiPageView (or use in-page navigation)
- [ ] 11.6 Rewrite synthesis section in ProjectDetail.tsx: replace `<details>/<pre>` blocks with WikiSearch + WikiPagesTable
- [ ] 11.7 Handle empty states: no synthesis yet, no API key for search, search error

## 12. Skills Update

- [ ] 12.1 Rewrite `fabrick-analyze` skill SKILL.md — 4-step flow: `fabrick scan` → LLM reads source files → LLM writes wiki pages → `fabrick rebuild-source-map`. Include wiki page format spec, taxonomy guidelines, index.md format
- [ ] 12.2 Remove scanner.md and synthesis.md from fabrick-analyze skill (scan logic moved to CLI, wiki generation done by LLM in session)
- [ ] 12.3 Remove `fabrick-search` skill directory entirely
- [ ] 12.4 Update `fabrick-push` skill to reference `.fabrick/wiki/`
- [ ] 12.5 Rebuild `claude-skills.zip` with updated skills

## 13. Verification

- [ ] 13.1 Run `fabrick-analyze` skill on a test repo — verify `.fabrick/wiki/` created with pages, index.md, hashmap.json, source-map.json
- [ ] 13.2 Modify a source file, run `fabrick-analyze` skill again — verify only affected pages updated (incremental)
- [ ] 13.3 Run `fabrick push` — verify wiki uploaded to blob storage
- [ ] 13.4 Trigger synthesis — verify project wiki pages appear in wiki_pages table
- [ ] 13.5 Call `fabrick_search` via MCP — verify answer returned for architectural question
- [ ] 13.6 Test monorepo: run analyze on a monorepo, verify per-app wikis created
- [ ] 13.7 Open console → project detail → verify wiki pages table renders, page viewer renders markdown
- [ ] 13.8 Use console search box → ask question → verify answer rendered
