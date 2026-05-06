## 1. Update Synthesis Prompt

- [x] 1.1 In `applications/backend/synthesis/src/assets/synthesis-prompt.txt`, replace the `## Output format` section to instruct Claude to respond using delimiter format (`=== FILE: <name> ===`) with no JSON, no code blocks, no explanation

## 2. Replace Parser in Processor

- [x] 2.1 In `applications/backend/synthesis/src/synthesis/synthesis.processor.ts`, remove the `codeBlockMatch` regex and `JSON.parse` logic
- [x] 2.2 Replace with delimiter parser: split `rawText` on `/\n?=== FILE: /`, extract filename (before ` ===\n`) and content (after ` ===\n`, trimmed) for each chunk
- [x] 2.3 Throw `No files found in Claude response` if zero files parsed

## 3. Update Tests

- [x] 3.1 In `applications/backend/synthesis/src/synthesis/synthesis.processor.spec.ts`, update mock Claude responses from JSON format to delimiter format
- [x] 3.2 Add test case: response with no `=== FILE:` markers throws expected error
- [x] 3.3 Add test case: file content containing quotes and newlines is parsed correctly
- [x] 3.4 Run `npm run test` in `applications/backend/synthesis` and confirm all tests pass
