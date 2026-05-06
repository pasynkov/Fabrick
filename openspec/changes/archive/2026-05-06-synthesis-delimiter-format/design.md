## Context

The synthesis processor sends a prompt to Claude asking it to return multiple file contents. Currently the expected format is a JSON object with filenames as keys and file contents as string values. Claude consistently produces invalid JSON because it writes literal newlines inside string values instead of `\n` escape sequences. The error manifests as `Unterminated string in JSON` at the first multi-line file content.

## Goals / Non-Goals

**Goals:**
- Eliminate JSON parse failures in synthesis processor
- Keep the change minimal — two files, no external contracts broken

**Non-Goals:**
- Changing stored file formats in S3/MinIO
- Changing the synthesis API contract
- Adding retry logic or error recovery beyond what already exists

## Decisions

### Delimiter format over tool use

**Decision:** Use a plain-text delimiter format instead of the Anthropic tool use API.

**Rationale:** Tool use would require significant structural changes to the processor (tool definition, response parsing, different SDK call shape). The delimiter approach achieves the same robustness with minimal code change — only the prompt section and the parser change.

**Delimiter format:**
```
=== FILE: index.md ===
<content — any characters, no escaping required>

=== FILE: overview.md ===
<content>
```

**Why `=== FILE: name ===`:** Visually distinct, unlikely to appear in generated markdown content, consistent with the existing input format which uses `=== REPO: name ===`.

### Parser implementation

Split `rawText` on `/\n?=== FILE: /` regex. For each chunk after index 0:
- Filename = text before first ` ===\n`
- Content = text after ` ===\n`, trimmed at end

Throw if zero files parsed — same failure surface as before.

### Remove codeBlockMatch stripping

The current code strips markdown code fences before JSON parsing. With delimiter format, Claude is instructed to respond with no wrapping — the stripping is unnecessary and removed.

## Risks / Trade-offs

- **`=== FILE:` in generated content** → extremely unlikely in markdown architecture docs; no mitigation needed
- **Claude ignores format instructions** → same risk exists with JSON; delimiter format is more natural for Claude to produce correctly
- **Rollback** → revert prompt + parser to JSON; no data migration needed

## Open Questions

None.
