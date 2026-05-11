## Context

Search has been silently broken since the wiki index was introduced. The `index.md` page uses standard markdown link syntax (`[Title](apps/page.md)`), and when Claude selects slugs from the index content it extracts them with the `.md` extension. `slugToPath` then appends another `.md`, producing a path like `apps/harvester-conductor.md.md` that does not exist.

Current state:
- `search.impl.ts`: no input/output logging; slug normalization absent
- `synthesis-prompt.ts`: generates index links as `(slug.md)` (standard markdown)
- `mcp/src/index.ts`: `FALLBACK_INSTRUCTIONS` discourages unnecessary use but says nothing about parallel calls

## Goals / Non-Goals

**Goals:**
- Fix slug resolution so searches actually return results
- Make the search pipeline observable via structured logs
- Reduce parallel/retry MCP tool calls via server instructions

**Non-Goals:**
- Changing search architecture (2-step Claude pipeline stays)
- Adding metrics, tracing, or external observability tooling
- Modifying how Claude selects slugs (prompts stay as-is)

## Decisions

### 1. Slug normalization: two-layer fix

Both layers are needed independently:

**Layer 1 — Defensive strip in `search.impl.ts`** (after Claude responds):
```ts
selectedSlugs = parsed.map(s => s.replace(/\.md$/i, ''));
```
This handles any malformed slug regardless of source. Cheap, safe, no side effects.

**Layer 2 — Fix synthesis index link format** in `synthesis-prompt.ts`:
Index links should use slug format without extension: `[Title](apps/page)` not `[Title](apps/page.md)`. This is the root cause and prevents the bug from recurring for future wikis.

Alternative considered: make `slugToPath` tolerate `.md` suffix — rejected because it would silently mask other slug errors.

### 2. Logging: NestJS Logger at pipeline stages

Add `this.logger.log()` at three points in `search.impl.ts`:
1. Entry: `projectId`, `question`
2. After slug selection: selected slugs array
3. After page load: count and slugs

No structured log library needed — NestJS Logger is already imported and used on line 72.

### 3. MCP call guidance: server instructions, not mcp-description

`mcp-description` is a generated wiki page that gets overwritten on every synthesis run — embedding behavioral guidance there would be lost. Server instructions (`instructions` field in `new Server()`) persist from the fallback constant and from the `mcp-instructions` wiki page.

Decision: add single-call guidance to `FALLBACK_INSTRUCTIONS` in `index.ts` and create an `mcp-instructions` spec requirement for the synthesis to generate this page for projects that run synthesis.

## Risks / Trade-offs

- **Synthesis prompt change**: Changing link format in index from `.md` to no extension may affect other consumers that parse the index page. Risk is low — the only known consumer of index links is the slug selection LLM step, which is what we're fixing.
- **MCP instructions are hints, not enforcement**: Claude may still parallelize tool calls despite instructions. The guidance reduces frequency but cannot eliminate it. Accepted trade-off — enforcing via rate limiting would break legitimate use cases.
- **Existing index pages not automatically updated**: Projects that have already run synthesis will keep `.md` links in their stored index until re-synthesis runs. The defensive strip in `search.impl.ts` covers this case.
