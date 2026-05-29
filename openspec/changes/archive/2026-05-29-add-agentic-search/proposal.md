## Why

The current search is a fixed 2-step flow: load the index page, ask Claude to pick up to 5 slugs, then ask Claude to answer from those pages. For large, deeply structured projects this is too shallow — the model gets one chance to guess the right pages from index titles alone, cannot drill into related pages, and cannot recover when the first pick is wrong. We want richer answers without giving up the existing API contract.

## What Changes

- Replace the 2-shot search with an **agentic tool-use loop** using the Anthropic SDK (`messages.create` with `tools`, dispatch on `stop_reason`).
- Add narrow tools the model can call to navigate the wiki incrementally:
  - `list_categories()` — distinct categories in the project
  - `list_in(category)` — `[{slug, title, one_liner}]`
  - `page_meta(slug)` — `{title, category, related[], sources[], size}`
  - `read_page(slug)` — full content
  - `read_pages([slugs])` — batched read
  - `read_related(slug, depth=1)` — neighborhood via `WikiPage.related[]`
- Inject the index page as a cached initial user message (no tool call needed for it).
- Enable Anthropic **prompt caching** (`cache_control: ephemeral`) on the system block and on the index user message.
- Apply **budget caps**: `max_iters`, `max_pages_read`, `max_total_tokens`.
- Handle `stop_reason` cases: `tool_use` → execute & continue; `end_turn` → parse final markdown and extract a trailing `SOURCES: <slug>, ...` line; `max_tokens` → ask the model to summarize with current context; iter/budget exhausted → ask for a partial answer with sources collected so far.
- Extend `WikiRepository` with cheap metadata projections: `findCategories(projectId)`, `findByCategory(projectId, category)`.
- Preserve the existing `{ answer, sources }` response shape (API contract unchanged).
- Out of scope (flagged for follow-up changes): synthesis-side per-page size cap, fulltext/embeddings search, eval framework, observability extensions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `shared-search-impl`: replace 2-step Claude flow with agentic tool-use loop and budget handling.
- `fabrick-search`: update behavior description to reflect the loop while preserving response shape and auth/resolution split.
- `shared-wiki-repository`: add cheap metadata projection methods (`findCategories`, `findByCategory`).
- `mcp-search-tool`: clarify that richer multi-hop answers are possible while the contract and one-call-per-question guidance remain unchanged.

## Impact

- Code: `applications/backend/shared/src/search/search.impl.ts` rewritten as an agentic loop; `WikiRepository` interface and TypeORM/FS implementations gain two metadata methods.
- API: `POST /orgs/:org/projects/:project/search` response shape unchanged; observed latency and token cost will increase per request.
- Cost: more LLM calls per query, partially offset by prompt caching on system + index blocks. Tool calls and per-iter context growth must be capped.
- Operations: existing `search-observability` spec covers logs/metrics; extending it for per-iter and cache-hit signals is deferred to a follow-up.
- Upstream coupling: tool results are not truncated at runtime — over-sized pages must be prevented at synthesis time (separate change).
