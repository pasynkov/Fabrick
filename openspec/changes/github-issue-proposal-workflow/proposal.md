## Why

The current SDLC has no structured way to capture and refine ideas before they become proposals. Engineers open issues informally, but there's no automated path from "idea in issue" to "proposal artifacts in branch". This change closes that gap by making GitHub issues the entry point into the AI-assisted SDLC.

## What Changes

- New GitHub label set: `proposal:exploring`, `proposal:ready` (alongside existing `proposal`)
- New GH Actions workflow: `ci-proposal-explore.yml` — triggers on `issues[labeled=proposal]` and `issue_comment[created]` to run AI-assisted `/openspec-explore` dialogue via issue comments
- New GH Actions workflow: `cd-proposal-create.yml` — triggers on `issues[labeled=proposal:ready]` to run `/openspec-propose`, create branch `proposal/<name>`, and push (with `refs #<issue>` in commit)
- Existing `ci-proposal-review.yml` remains unchanged — fires automatically when branch is pushed

## Capabilities

### New Capabilities

- `github-issue-explore-dialogue`: AI-driven conversation in GitHub issue comments — starts on `proposal` label, continues on each non-bot comment, suggests `proposal:ready` when exploration is complete
- `github-issue-to-branch`: On `proposal:ready` label, reads full issue thread, generates OpenSpec artifacts via `/openspec-propose`, creates `proposal/<name>` branch with commit referencing the issue number

### Modified Capabilities

## Impact

- `.github/workflows/` — 2 new workflow files
- `.github/` — label definitions (if managed as code)
- `.github/workflows/ci-proposal-review.yml` — add `@fission-ai/openspec` install step (bugfix: currently missing, skills fail silently)
- No changes to existing application code or APIs
- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret (already present) and `contents: write` + `issues: write` permissions in new workflows
