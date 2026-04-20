---
name: fabrick-search
description: Answer architectural questions about the project by navigating the Fabrick synthesis via MCP tools. Requires Fabrick MCP server configured via `fabrick init`.
---

Answer the user's architectural question about this project using the Fabrick MCP server.

## Steps

1. Call `get_synthesis_index` — no arguments needed. Returns the navigation index.
2. Read the index to identify which file(s) are relevant to the user's question.
3. Call `get_synthesis_file` with the relevant path (e.g. `"apps/backend.md"`, `"cross-cutting/envs.md"`).
4. Answer the user's question based on what you read.

## Rules

- Always start with `get_synthesis_index`. Never skip it.
- Call `get_synthesis_file` only for files the index says are relevant — not all files.
- Typically 1–2 `get_synthesis_file` calls are enough. Stop when you have the answer.
- If the index tool returns an error about synthesis not being available, tell the user to run synthesis first from the Fabrick console.
- Be concise and direct. Quote specific names, values, and paths from the synthesis files.

## Examples

**Q: "Which app handles context uploads? What are its envs?"**
→ `get_synthesis_index` → index identifies `apps/backend.md` → `get_synthesis_file("apps/backend.md")` → answer

**Q: "What env vars does the system use?"**
→ `get_synthesis_index` → index identifies `cross-cutting/envs.md` → `get_synthesis_file("cross-cutting/envs.md")` → answer

**Q: "How does the frontend call the backend?"**
→ `get_synthesis_index` → index identifies `cross-cutting/integrations.md` → `get_synthesis_file("cross-cutting/integrations.md")` → answer
