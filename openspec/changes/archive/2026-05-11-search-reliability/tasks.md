## 1. Fix Slug Resolution Bug

- [x] 1.1 In `search.impl.ts`, add `.map(s => s.replace(/\.md$/i, ''))` to `selectedSlugs` after parsing Claude's response
- [x] 1.2 In `synthesis-prompt.ts`, update the index page generation prompt to use slug paths without `.md` extension in markdown links
- [x] 1.3 Manually fix existing `index.md` in sandbox-data: replace all `(slug.md)` links with `(slug)` (no extension)

## 2. Add Search Logging

- [x] 2.1 In `search.impl.ts`, add entry log after method start: log `projectId` and `question`
- [x] 2.2 In `search.impl.ts`, add log after slug selection: log selected slugs array
- [x] 2.3 In `search.impl.ts`, add log after page load: log count and slugs of loaded pages

## 3. MCP Single-Call Guidance

- [x] 3.1 In `mcp/src/index.ts`, update `FALLBACK_INSTRUCTIONS` to include: call `fabrick_search` at most once per question; if wiki has no answer, report "not in wiki" rather than retrying
- [x] 3.2 In `synthesis-prompt.ts`, add generation of `mcp-instructions` page with single-call guidance and description of wiki coverage vs gaps (source-code-level details not captured)

## 4. Synthesis mcp-instructions Page

- [x] 4.1 In `synthesis-prompt.ts`, add `mcp-instructions` to the list of pages the LLM must generate
- [x] 4.2 Verify sandbox `mcp-instructions` page is generated correctly by running synthesis or manually creating it
