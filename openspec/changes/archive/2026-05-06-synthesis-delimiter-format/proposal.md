## Why

The synthesis service systematically fails with `Claude returned non-JSON: Unterminated string in JSON at position 1452` because Claude includes literal unescaped newlines inside JSON string values when returning file contents. This is not an occasional edge case — it happens every time file content is multi-line.

## What Changes

- Synthesis prompt output format changed from JSON to delimiter-based format
- Synthesis processor parser replaced: `JSON.parse` → delimiter splitter
- `codeBlockMatch` regex stripping removed (no longer needed)
- Spec tests updated to use delimiter format in mock responses

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `fabrick-synthesis`: Output format contract between prompt and parser changes from JSON to delimiters. No external API or storage schema changes — only the internal Claude ↔ processor protocol.

## Impact

- `applications/backend/synthesis/src/assets/synthesis-prompt.txt` — output format section rewritten
- `applications/backend/synthesis/src/synthesis/synthesis.processor.ts` — parser replaced
- `applications/backend/synthesis/src/synthesis/synthesis.processor.spec.ts` — mock responses updated
- No API changes, no storage schema changes, no client impact
