## 1. MCP Server Instructions

- [x] 1.1 Add `instructions` string to `Server` constructor in `applications/mcp/src/index.ts` using `ServerOptions.instructions`, referencing `${project}` name
- [ ] 1.2 Verify `instructions` field appears in MCP handshake (manual test or inspect transport output)


## 2. Synthesis Prompt Update

- [x] 2.1 Update `mcp-description` generation instructions in `applications/backend/shared/src/synthesis/synthesis-prompt.ts` to require a `## When to use` section
- [x] 2.2 Ensure the prompt instructs synthesis to base "When to use" on actual layers/apps present — not generic, not "always use"

## 3. Verification

- [ ] 3.1 Re-run synthesis on sandbox project, confirm `mcp-description` output contains `## When to use` section with concrete cross-layer examples
- [ ] 3.2 Connect MCP client (Claude Code), confirm `instructions` are received (check MCP inspector or Claude's tool context)
