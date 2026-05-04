## Why

During the explore dialogue, the AI asks clarifying questions and users often say "yes" to suggested features that weren't in the original request (e.g., "audit logging"). These addons get fully incorporated into proposal artifacts, doubling scope and bloating token usage across all downstream pipeline steps (apply, simplify, review, review-fix).

## What Changes

- Update `ci-proposal-explore.yml` prompt: when AI suggests a feature not present in original issue body, it SHALL explicitly mark it as `⚠️ ADDON` and recommend creating a separate issue rather than folding it into the current proposal
- Add scope-check step in `cd-proposal-create.yml` after artifact generation: AI compares original issue body against generated tasks/proposal, identifies addon capabilities, extracts each addon into its own change with full artifacts on a separate branch, and removes it from the original change

## Capabilities

### New Capabilities

- `proposal-addon-detection`: AI-driven identification of capabilities in generated artifacts that are not traceable to the original issue body — produces a split: clean core change + zero or more addon branches

### Modified Capabilities

- `github-issue-explore-dialogue`: Explore dialogue now explicitly flags AI-suggested features not in the original issue body as ADDONs and recommends separate issues

## Impact

- `.github/workflows/ci-proposal-explore.yml` — prompt updated with addon-flagging instruction
- `.github/workflows/cd-proposal-create.yml` — new scope-check step added after artifact generation, before commit-and-push
- New addon branches push to `proposal/<issue>-<addon-name>` — auto-triggers existing `ci-proposal-review.yml`
- No changes to `ci-proposal-review.yml` or downstream workflows
