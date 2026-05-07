## Why

Synthesis currently generates a flat set of files organized by repository and stores them in blob storage. Each run is a full regeneration — there is no accumulated knowledge, no cross-references, and MCP retrieves files by path rather than navigating by meaning. Applying the LLM Wiki pattern makes synthesis output persistent, concept-organized, and incrementally maintained.

## What Changes

- Synthesis output moves from blob storage to **PostgreSQL** (`synthesis_pages` table)
- Pages are organized by **concept taxonomy** (entities/, services/, flows/, contracts/) plus a root index — not by repository
- Synthesis worker becomes **incremental**: reads existing pages from DB + one repo's context from MinIO → upserts only the affected pages (5–15 per run)
- MCP navigation stays index-first but reads from DB via API instead of blob storage
- No endpoint renames. No schema changes to the queue message contract.

## Capabilities

### New Capabilities

- `synthesis-pages-db`: PostgreSQL table `synthesis_pages` storing concept-organized pages with slug, category, content, and source repo tracking. API endpoints to read pages by slug and list pages by category.

### Modified Capabilities

- `fabrick-synthesis`: Worker logic changes from full-regeneration-to-blob to incremental-upsert-to-postgres. LLM prompt changes: given existing pages + new repo context, output only the pages that need creating or updating.
- `fabrick-search`: MCP tool `get_synthesis_file` maps path argument to DB slug lookup. `get_synthesis_index` returns the root index page from DB instead of blob storage. No change to MCP tool names or signatures.

## Impact

- **synthesis app**: New DB connection (reuses existing Postgres). New prompt logic. Removes blob write for synthesis output (MinIO still used for raw context).
- **backend API**: New `synthesis_pages` table. New endpoints: `GET /orgs/:org/projects/:project/synthesis/pages` (list), `GET /orgs/:org/projects/:project/synthesis/pages/*slug` (read by slug). Existing `/synthesis/file?path=` maps to slug lookup internally — no client changes.
- **MCP**: No interface changes. Internal implementation switches from blob fetch to API slug lookup.
- **Infrastructure**: No new services. Postgres already provisioned.
