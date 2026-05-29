## Why

The current `ci-implementation.yml` is a 460-line monolith that hard-codes every implementation stage (apply, simplify, review, review-fix, build, build-fix, archive, promote) as separate shell + `claude-code-base-action` steps. It is hard to maintain, hard to extend, cannot be run locally for debugging, and is inconsistent with the proposal pipeline that already moved to a multi-agent orchestrator skill (`cd-proposal-pipeline`). Implementation is the second half of the same loop and should follow the same pattern.

## What Changes

- Introduce a new orchestrator skill `cd-implementation-pipeline` at `.claude/skills/cd-implementation-pipeline/SKILL.md` that drives the end-to-end implementation pipeline from an `implementation/<name>` branch through merged-PR readiness.
- Add five NEW subagents under `.claude/agents/`:
  - `change-applier` — runs the `openspec-apply-change` skill; free to add/modify e2e tests; must leave `applications/backend/api` e2e green; commits `feat: apply <name>`.
  - `simplifier` — runs the `simplify` skill; SHALL NOT touch test files; must leave e2e green; commits `refactor: simplify <name>`.
  - `reviewer` — runs `review` then `review-fix`; SHALL NOT touch test files; validates that the applier added tests for new behaviour and changed old tests only where the spec demanded it; on a TDD gap returns `ERROR: TDD gap on <task-refs>` so the orchestrator can re-route to the applier; commits `fix: review fixes for <name>`.
  - `build-fixer` — invoked only when one of the parallel app builds fails; minor test edits permitted; SHALL NOT touch `package.json`, `tsconfig.json`, or other build configs; commits `fix: build failures for <name>`.
  - `archiver` — runs `openspec-archive-change` non-interactively (skip sync prompts, proceed if tasks are incomplete); commits `chore: archive <name>`.
- Reuse the existing `gh-ops` and `git-ops` subagents from the proposal pipeline (no changes to those agents).
- Define a 7-step pipeline executed sequentially by the orchestrator:
  - Step 0 — `gh-ops` labels the issue `implementation:apply`.
  - Step 1 — `change-applier` (skip if `feat: apply <name>` already in git log).
  - Step 2 — `simplifier` (skip if `refactor: simplify <name>` already in git log).
  - Step 3 — `reviewer` (skip if `fix: review fixes for <name>` already in git log). TDD-gap signal triggers one applier→reviewer bounce; second unresolved gap is logged and the pipeline continues.
  - Step 4 — orchestrator issues 6 parallel `Bash` calls in a single response to build `backend/api`, `backend/synthesis`, `console`, `landing`, `cli`, `mcp`. On any failure, spawn `build-fixer` with the failure dump; up to 3 total build attempts.
  - Step 5 — `archiver` (skip if `openspec/changes/archive/*-<name>` already exists).
  - Step 6 — `git-ops` pushes `implementation/<name>`.
  - Step 7 — promoter: `git-ops` renames `implementation/<name>` → `feature/<name>` and pushes, then `gh-ops` opens the PR to `develop`, swaps the issue label `implementation:apply` → `implementation:ready`, and comments the PR URL on the issue.
- Doer agents commit their own work directly; `git-ops` is used only for branching, pushing, and the promote rename.
- Per-step retry budget: max 2 subagent attempts per step. Step 1 and step 5 abort the pipeline on second failure; step 2, step 3 (crash, not TDD signal), and step 7 warn and continue. Step 4 carries its own 3-attempt budget for builds.
- Orchestrator does NOT validate the work of any doer; it reads a short summary and chains. Failure signal is a subagent reply prefixed `ERROR:`.
- Stage skipping uses `git log --grep` for apply/simplify/review and `openspec/changes/archive/*-<name>` presence for archive.
- Rename `.github/workflows/ci-implementation.yml` → `.github/workflows/cd-implementation.yml` and reduce it to a thin wrapper that checks out, installs `@fission-ai/openspec` and root deps, and runs the orchestrator via `anthropics/claude-code-base-action@beta` with `<repo> <change-name>` as positional args. Promotion folds into the pipeline as step 7 (the current separate `promote` job is removed).
- Unified argv: `<owner/repo> <change-name>` for both CI and local invocation. The workflow extracts `<change-name>` from `${GITHUB_REF#refs/heads/implementation/}` (stripping a leading issue-id prefix when no exact change directory matches) and passes it as the second arg.
- Add `.claude/skills/cd-implementation-pipeline/fixtures/` with a sample branch description and a minimal `openspec/changes/<name>/` tree for local dry-run smoke tests.

## Capabilities

### New Capabilities
- `multi-agent-implementation-pipeline`: the orchestrator skill, its 7-step contract, the five new subagent contracts (change-applier, simplifier, reviewer, build-fixer, archiver), the per-step retry policy, the build-attempt budget, the TDD bounce policy, the stage-skip checks, the unified argv contract, and the cd-implementation workflow that drives it.

### Modified Capabilities
- `ci-implementation-apply`: the existing capability documents the old monolithic workflow (`ci-implementation.yml` with an `apply` job, explicit `gh workflow run` dispatch from `cd-proposal-promote.yml`, and a `push` trigger on `implementation/**`). The requirements are revised so the workflow file is renamed to `cd-implementation.yml`, becomes a thin wrapper around the orchestrator skill, drops the in-yaml apply/archive/promote job split, and retains the push trigger and the dispatch from `cd-proposal-promote.yml`. The skill is the only place that implements the stage logic.

## Impact

- Files added:
  - `.claude/skills/cd-implementation-pipeline/SKILL.md`
  - `.claude/skills/cd-implementation-pipeline/fixtures/` (sample branch + sample change tree)
  - `.claude/agents/change-applier.md`
  - `.claude/agents/simplifier.md`
  - `.claude/agents/reviewer.md`
  - `.claude/agents/build-fixer.md`
  - `.claude/agents/archiver.md`
- Files modified or renamed:
  - `.github/workflows/ci-implementation.yml` → `.github/workflows/cd-implementation.yml` (thin wrapper)
  - `.github/workflows/cd-proposal-promote.yml` if it currently dispatches `ci-implementation.yml` by file name — the dispatch target name changes.
- Files unchanged:
  - `.claude/agents/gh-ops.md`, `.claude/agents/git-ops.md` (reused as-is)
  - `.claude/skills/cd-proposal-pipeline/SKILL.md` and the proposal pipeline overall.
- Operational change: the implementation stage logic moves entirely into a Claude-driven orchestrator. Failures and partial successes surface through subagent summaries rather than yaml step outputs. Local dry-run becomes a first-class workflow.
- Out of scope (flagged for separate changes): adding unit-test runs for non-api apps in the build gate; changing the e2e framework; parallelising the apply/simplify/reviewer stages.
