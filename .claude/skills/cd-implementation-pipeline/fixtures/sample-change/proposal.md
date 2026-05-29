## Why

A minimal sample change used by the cd-implementation-pipeline skill for local dry-run smoke tests. It is not meant to be implemented — its tasks are no-ops the doer agents can satisfy trivially.

## What Changes

- Demonstrate a structurally complete `openspec/changes/<name>/` tree with one capability spec.

## Capabilities

### New Capabilities
- `sample-capability`: a tiny capability used only to satisfy the proposal-author and reviewer contracts in fixture tests.

### Modified Capabilities
- (none)

## Impact

- No production code is changed. Used only as a fixture in `.claude/skills/cd-implementation-pipeline/fixtures/sample-change/`.
