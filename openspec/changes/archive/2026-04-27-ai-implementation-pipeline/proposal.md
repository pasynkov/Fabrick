## Why

The AI SDLC pipeline stops at branch creation: `cd-proposal-promote` creates `implementation/<name>` but leaves actual implementation to humans. Adding an automated apply step closes this gap — Claude implements the OpenSpec tasks autonomously before archiving and promoting.

## What Changes

- Rename `ci-implementation-archive.yml` → `ci-implementation.yml`
- Add `apply` job (new, runs first) that executes `openspec-apply-change` via `claude-code-base-action`
- Add `workflow_dispatch` trigger to `ci-implementation.yml` (GitHub Actions does not chain workflows via push from Actions bots)
- Update `cd-proposal-promote.yml` to explicitly trigger `ci-implementation.yml` after branch creation
- Keep `push: branches: ['implementation/**']` trigger for local developer pushes

## Capabilities

### New Capabilities

- `ci-implementation-apply`: Autonomous AI implementation step — runs Sonnet via `claude-code-base-action` to execute all pending OpenSpec tasks on the `implementation/<name>` branch, commits result, then hands off to archive

### Modified Capabilities

- `ci-implementation-archive` → `ci-implementation`: Workflow renamed and extended with apply job; archive and promote jobs become downstream

## Impact

- `.github/workflows/ci-implementation-archive.yml` — renamed to `ci-implementation.yml`, restructured
- `.github/workflows/cd-proposal-promote.yml` — adds explicit workflow dispatch step
- No application code changes
- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret (already present)
