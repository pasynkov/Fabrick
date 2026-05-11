## Why

Claude does not call `fabrick_search` when it should — it answers project-specific questions from training data instead of the wiki. Conversely, adding a blanket "always use this tool" instruction would over-trigger on local questions Claude can answer from context. The fix is context-aware routing: call the tool when crossing service/layer boundaries, skip it for local questions.

## What Changes

- `mcp-description` synthesis output gains a "When to use" section listing covered layers/apps and cross-layer trigger conditions (e.g., "working in frontend and need backend API contracts")
- MCP server (`index.ts`) adds `instructions` to the `Server` constructor — a hardcoded routing rule that tells Claude to use `fabrick_search` only when the question crosses service or layer boundaries

## Capabilities

### New Capabilities

- `mcp-tool-routing`: Rules governing when `fabrick_search` should be invoked, delivered via two channels: MCP `instructions` field (behavior rule) and `mcp-description` wiki page (knowledge map with cross-layer triggers)

### Modified Capabilities

- `mcp-search-tool`: The `mcp-description` generation instructions in the synthesis prompt gain a "When to use" section requirement
- `fabrick-mcp-server`: MCP server constructor gains `instructions` field

## Impact

- `applications/backend/shared/src/synthesis/synthesis-prompt.ts` — updated `mcp-description` generation instructions
- `applications/mcp/src/index.ts` — `Server` constructor updated with `instructions`
- No API changes, no breaking changes
