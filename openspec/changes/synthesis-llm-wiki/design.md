## Context

Synthesis today: worker reads all repo contexts from MinIO → LLM generates flat markdown files organized by repository → writes back to blob storage → MCP fetches by file path via `GET /synthesis/file?path=`.

Problems:
- Output organized by repo, not concept — cross-repo knowledge doesn't compound
- Full regeneration every run — no accumulated state
- Blob storage for structured data — no query capability, slow path lookup
- MCP navigates by file path, not meaning

PostgreSQL is already provisioned (both local and Azure). The synthesis worker already has a callback pattern (`callbackToken` in queue message, `POST /internal/synthesis/status`). We extend that pattern rather than introducing new infrastructure.

## Goals / Non-Goals

**Goals:**
- Synthesis output stored in PostgreSQL as concept-organized pages
- Pages organized by taxonomy: `index`, `entities/*`, `services/*`, `flows/*`, `contracts/*`
- `getSynthesisFileBySlug` reads from DB instead of blob storage
- Synthesis worker outputs page upserts via existing callback pattern
- No change to MCP tool signatures or queue message schema

**Non-Goals:**
- Per-repo incremental synthesis (full project synthesis per run, just stored differently)
- Vector search or embeddings
- Migration of existing blob synthesis output to DB (new runs replace old)
- Renaming any endpoints or tools

## Decisions

### Decision: synthesis_pages in the API's database, not a new service

Alternatives considered:
- **Separate search/knowledge service** — unnecessary new service, Postgres already there
- **Keep blob, add search index on top** — double write, more complexity, slower reads

Rationale: API already owns `projects` and `repositories`. `synthesis_pages` belongs alongside them. Worker writes via callback endpoint (already established pattern).

### Decision: project_id FK, not org+project slugs

Pages are scoped to a project. Using `project_id` (UUID) is a stable FK, not a denormalized slug pair. Slug-based lookup (from HTTP path) resolves project_id via existing org+project lookup logic.

### Decision: Synthesis worker writes pages via internal API endpoint

Worker already calls back via `POST /internal/synthesis/status` with `callbackToken`. We add `PUT /internal/synthesis/pages` protected by the same token. Worker sends array of page upserts. No direct DB connection from synthesis worker.

Alternatives considered:
- **Worker connects directly to DB** — couples synthesis to DB schema, breaks isolation
- **Worker writes to blob, API syncs** — two writes, eventual consistency issues

### Decision: LLM outputs structured page array, not markdown files

Current prompt: "write these markdown files". New prompt: "output a JSON array of pages `[{ slug, category, title, content, sources }]` to upsert". Worker parses JSON, calls API. Cleaner than parsing filenames from a filesystem write.

### Decision: Existing /synthesis/file?path= maps slug internally

`getSynthesisFileBySlug(filePath)` already takes a path string. We change its implementation to query `synthesis_pages WHERE project_id = ? AND slug = filePath`. No MCP change, no API route change. The `path` query param becomes a slug.

## Risks / Trade-offs

- **First run after deploy has no existing pages** → LLM generates from scratch (same as today). Subsequent runs compound. Risk: none, graceful degradation.
- **LLM outputs invalid JSON** → Worker wraps parse in try/catch, reports error via status callback. Risk: low, prompt can enforce JSON mode.
- **Page taxonomy ambiguity** (is "checkout" a flow or a service?) → LLM decides. Index page cross-references handle ambiguity. Risk: acceptable, index navigation works even with imperfect taxonomy.
- **synthesis_pages grows unbounded** → Pages are upserted, not appended. Row count = number of unique slugs per project. Bounded by project complexity. Risk: none.

## Migration Plan

1. Add DB migration: create `synthesis_pages` table
2. Deploy API with new entity + internal upsert endpoint + updated `getSynthesisFileBySlug`
3. Deploy synthesis worker with new prompt + page upsert call
4. Next synthesis run for any project writes pages to DB; MCP reads from DB
5. Old blob synthesis output remains in storage but is no longer read — no cleanup needed immediately

Rollback: revert API `getSynthesisFileBySlug` to blob path — blob files still exist.
