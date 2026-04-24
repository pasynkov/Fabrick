## Why

Part of the AI SDLC initiative. A developer branches from `develop` into `proposal/<name>`, commits OpenSpec artifacts, and pushes. Currently nothing validates or promotes the proposal automatically. This change adds an automated AI review gate that checks proposal completeness and promotes the branch to `implementation/<name>` on pass.

## What Changes

- New Claude Code skill `review-proposal`: checks that all required OpenSpec artifacts exist for a given change name
- New GitHub Actions workflow `ci-proposal-review.yml`: triggers on push to `proposal/**`, runs the skill via `claude-code-action`, promotes to `implementation/<name>` on success

## Capabilities

### New Capabilities

- `review-proposal`: Claude Code skill invoked in CI to validate proposal completeness
- `ci-proposal-review`: GitHub Actions workflow — review gate + branch promotion for proposal branches

### Modified Capabilities

_(none)_

## Impact

- `.claude/skills/review-proposal/SKILL.md` — new skill
- `.github/workflows/ci-proposal-review.yml` — new workflow
- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret in GitHub repository settings
