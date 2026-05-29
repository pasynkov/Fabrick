## Context

Current `SearchImpl` (`applications/backend/shared/src/search/search.impl.ts`) performs a fixed 2-step Claude flow:
1. Load the `index` wiki page.
2. Call Claude #1 with the index + question; expect a JSON array of up to 5 slugs.
3. Load those pages.
4. Call Claude #2 with the pages + question; return `{ answer, sources }`.

This works for small projects with shallow indexes but fails on larger projects: the model sees only the index titles and must guess correctly on the first try, has no way to drill into related pages, and cannot recover from a wrong pick. We want to use the Anthropic SDK's tool-use loop so the model can iteratively explore the wiki, while keeping the existing `{ answer, sources }` API contract.

Relevant pieces of the codebase:
- `applications/backend/shared/src/search/search.impl.ts` — current implementation.
- `applications/backend/shared/src/wiki-repository.interface.ts` — `WikiRepository` interface (`findBySlug`, `findBySlugs`, `findByProject`, `upsert`, `delete`) and `WikiPage` type with `slug`, `category`, `title`, `content`, `sources`, `related`.
- TypeORM- and FS-backed `WikiRepository` implementations consume the same interface.
- `mcp-search-tool` and the API search service both call `SearchImpl.search()` and rely on the `{ answer, sources }` shape.

Constraints:
- API contract must not change.
- Per-page size cap is **not** enforced here — must be handled at synthesis time (separate change).
- Anthropic prompt cache TTL is ~5 min; cache key requires stable prefix.

## Goals / Non-Goals

**Goals:**
- Replace the 2-step flow with an agentic tool-use loop using `messages.create` with `tools` and dispatch on `stop_reason`.
- Provide narrow tools that let the model discover (`list_categories`, `list_in`, `page_meta`), fetch (`read_page`, `read_pages`), and traverse (`read_related`) the wiki.
- Inject the `index` page as a cached initial user message so the model has structure available without spending a tool call.
- Enable Anthropic prompt caching on the system block and the index user message.
- Apply explicit budget caps so a single search cannot run away (iterations, pages read, total tokens).
- Handle every `stop_reason` deterministically, including `max_tokens` and budget exhaustion (partial answer).
- Keep the response shape `{ answer, sources }` unchanged.

**Non-Goals:**
- Fulltext search, grep over content, or embeddings-based retrieval.
- Runtime truncation of oversized pages (synthesis must produce reasonable sizes; separate change).
- A formal evaluation framework for search quality.
- Extending observability beyond what already exists in the `search-observability` spec.
- Caching tool results in our own infrastructure (rely on Anthropic prompt cache).

## Decisions

### Use Anthropic tool-use loop instead of multi-prompt orchestration
The Anthropic SDK supports tool-use natively: the model returns `stop_reason: "tool_use"` with `tool_use` blocks, we execute and append `tool_result` blocks to the conversation, and call `messages.create` again. The model decides when it has enough context and returns `stop_reason: "end_turn"`.

**Alternative considered:** hand-rolled multi-prompt chain where we ask the model to emit JSON instructions per step. Rejected because the SDK's tool-use protocol already handles parsing, validation, and turn semantics; hand-rolling would re-create that with less reliability.

### Narrow tools, mixed metadata + content
Tools are split between cheap metadata lookups (`list_categories`, `list_in`, `page_meta`) and content fetches (`read_page`, `read_pages`, `read_related`). Narrow tools let the model spend small tokens to plan and large tokens only when it commits to reading.

**Alternative considered:** a single `search(query)` tool that returns top-k pages. Rejected because it collapses the agency we want — the value of this change is that the model can decide *how* to explore, not just *what* keywords to search.

**Alternative considered:** metadata-only tools (force the model to call `read_page` separately for everything). Rejected because the model still needs content to answer; making content a separate explicit step is the right shape, but content tools must exist.

### Inject `index` as cached initial user message
The index page is small, stable per project, and almost always relevant. Putting it directly in the message prefix means:
- The model can plan from structure on turn 0.
- The prefix is identical across all queries for a project within the cache window, so `cache_control: ephemeral` gives consistent hits.

**Alternative considered:** force the model to call `list_categories` or `read_page('index')` to get it. Rejected — adds at least one round trip per query for information we always need, with no upside.

### Use Anthropic prompt caching on system + index blocks
Both blocks are stable per project. Cache breakpoints (`cache_control: { type: 'ephemeral' }`) are placed at:
- The end of the system block (agent instructions + tool descriptions).
- The end of the index user message.

The user's question and the growing tool-use/tool-result tail vary per query and are not cached.

**Trade-off:** prompt cache TTL is ~5 min, so cache hits depend on traffic. For a low-traffic project the cache may always miss — acceptable, the cost is no worse than today.

### Free-form system prompt with worked examples
The system prompt describes the role, lists the tools, and includes 2–3 short worked examples showing different shapes of question (single-page lookup, multi-hop via `read_related`, category browse). The prompt does not impose a rigid algorithm; the model decides when to stop.

**Alternative considered:** rigid step-by-step procedure ("always call X then Y then Z"). Rejected — defeats the point of an agentic loop; the model can usually pick a shorter path than a fixed procedure.

### Agent constructs `sources` in the final answer
The model is instructed to end its final markdown with a line `SOURCES: <slug>, <slug>, ...`. The loop parses that line, strips it from the answer text, and returns the slug list as `sources`.

**Alternative considered:** automatically collect every slug the model called `read_page`/`read_pages`/`read_related` on. Rejected because not every page read necessarily contributes to the final answer; letting the model curate the citation list is more accurate.

**Risk:** model forgets the `SOURCES:` line. Mitigation: if absent, fall back to "all pages read during the loop" and log a warning.

### Budget caps with graceful partial output
Caps:
- `MAX_ITERS = 8` (Claude turns in the loop)
- `MAX_PAGES_READ = 12` (counted across `read_page`, `read_pages`, `read_related`)
- `MAX_TOTAL_TOKENS = 50_000` (sum of input+output tokens reported by the API)

When a cap is hit and the model has not yet emitted `end_turn`, we append a user message: *"Budget exhausted. Give a partial answer with what you have and end with `SOURCES: ...`."* and make one final call. `stop_reason: "max_tokens"` is handled the same way.

**Alternative considered:** hard fail with an error when caps are hit. Rejected — partial answer is more useful than an error for the caller, who still gets `sources` to inspect.

### Add `findCategories` and `findByCategory` to `WikiRepository`
The `list_categories` and `list_in` tools need cheap projections. Adding two methods to the interface keeps DI clean and lets each backend implement them efficiently (e.g., TypeORM uses `SELECT DISTINCT category`, FS scans directory names).

**Alternative considered:** implement these on top of `findByProject` in the search layer. Rejected — `findByProject` loads full content for every page, defeating "cheap metadata".

### Keep the same response shape
The API search service still returns `{ answer, sources }`. The MCP search tool is unchanged. This change is purely an internal upgrade to `SearchImpl`.

## Risks / Trade-offs

- **Latency increases.** Today: ~2 LLM calls, ~3–5 s. Agentic: up to `MAX_ITERS+1` calls, can take 15–60 s. → Mitigation: prompt caching on prefix, narrow tools so the model can plan cheaply, budget caps.
- **Token cost increases.** More turns and accumulating context per query. → Mitigation: cache the stable prefix; cap `MAX_TOTAL_TOKENS`; instruct the model to be parsimonious in the system prompt.
- **Oversized tool results blow the context.** A wiki page might be very large. → Mitigation (here): no runtime truncation, but a separate change will enforce a per-page size cap at synthesis time. Until then, large pages will simply consume more of the per-query budget; the budget caps prevent unbounded damage.
- **Model loops without converging.** Could call tools forever without emitting `end_turn`. → Mitigation: hard iter/token caps + forced-partial finalization.
- **Model forgets `SOURCES:` line.** → Mitigation: warn-log and fall back to collected read history.
- **Cache miss on low-traffic projects.** → Trade-off accepted; cost is no worse than today.
- **Non-determinism.** Trace varies per query, harder to test/repro. → Mitigation: log per-iter tool calls and stop reasons; integration tests use a recorded transcript or a mocked Anthropic client at the SDK boundary.
- **Breaking change for any caller assuming today's slug-selection logs.** → No: `{ answer, sources }` shape is unchanged; only logs differ.

## Open Questions

- Exact numeric values for `MAX_ITERS`, `MAX_PAGES_READ`, `MAX_TOTAL_TOKENS` — the values listed above are starting defaults; we should make them configurable (env or constructor) and tune after first production data.
- Should `read_pages` be capped per call (e.g. max 6 slugs per batch)? Starting with 6.
- Whether to expose budget remaining to the model in tool results (e.g. "5 page reads left"). Defer until we see real traces.
