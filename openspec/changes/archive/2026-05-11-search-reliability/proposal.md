## Why

Search is silently returning empty results for every query due to a `.md` suffix bug in slug resolution introduced when writing the wiki index. Additionally, there is no logging to diagnose search behavior and no guidance to prevent MCP clients from issuing expensive parallel retry queries.

## What Changes

- **Fix slug resolution bug**: strip `.md` suffix from Claude-selected slugs before file lookup — prevents `file.md.md` path construction
- **Fix synthesis index generation**: stop emitting `.md` in relative links within generated index pages — eliminates the root cause
- **Add search logging**: log project/question at entry, selected slugs after LLM step 1, loaded pages after repo fetch
- **Add MCP call guidance**: add instructions to tool description and/or server instructions discouraging parallel/retry calls when wiki has no answer

## Capabilities

### New Capabilities
- `search-observability`: Structured log output at each stage of the search pipeline (entry, slug selection, page load, answer)

### Modified Capabilities
- `shared-search-impl`: Slug normalization (strip `.md`) added to the search pipeline before `findBySlugs`
- `mcp-search-tool`: Tool description and server instructions updated with single-call-per-turn guidance

## Impact

- `applications/backend/shared/src/search/search.impl.ts` — slug normalization + logging
- `applications/backend/shared/src/synthesis/synthesis-prompt.ts` — index link format (no `.md`)
- `applications/backend/sandbox/sandbox-data/pages/index.md` — regenerate or manually fix existing `.md` links
- `applications/mcp/src/index.ts` — server instructions fallback text (if no wiki page present)
- `applications/backend/sandbox/sandbox-data/pages/mcp-description.md` — add single-call guidance section
