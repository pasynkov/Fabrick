## Context

Current AI SDLC: GitHub Issue → explore → proposal branch → review → PR to develop → `cd-proposal-promote` creates `implementation/<name>`. After that, implementation is manual.

The `ci-implementation-archive.yml` workflow fires on push to `implementation/**`, but GitHub Actions does not trigger workflows from pushes made by the `github-actions[bot]` — so `cd-proposal-promote`'s branch creation push never triggers it. Currently the archive step is only useful for manual local pushes.

Key existing patterns:
- `claude-code-base-action@beta` used in archive step with `Bash,Read,Write,Edit,Glob`
- Explicit `gh workflow run` dispatch used in `cd-proposal-create.yml` and `ci-implementation-archive.yml`
- Extract change name from `GITHUB_REF` (branch-name-derived, not passed as input)

## Goals / Non-Goals

**Goals:**
- Autonomous AI implementation on `implementation/<name>` as part of the CI pipeline
- `cd-proposal-promote` reliably triggers the full implementation pipeline
- Local developer push to `implementation/**` also triggers the pipeline

**Non-Goals:**
- Human-in-the-loop review of implementation during CI (planned for future)
- Test execution or lint as part of implementation job (handled downstream in promote)
- Retry logic for blocked tasks

## Decisions

**D1: apply job runs before archive in the same workflow file**

Alternative: separate `ci-implementation-apply.yml`. Rejected — splits related pipeline into two files without benefit; jobs in one file share context naturally and the dependency chain (`archive needs apply`, `promote needs archive`) is explicit.

**D2: name derived from GITHUB_REF, not workflow_dispatch input**

Both `push` and `workflow_dispatch --ref` set `GITHUB_REF` to the branch. Single derivation path: `BRANCH="${GITHUB_REF#refs/heads/}" && NAME="${BRANCH#implementation/}"`. No need for an input parameter.

**D3: apply commit is separate from archive commit**

Two commits: `feat: implement <name>` and `chore(openspec): archive <name>`. Preserves clear separation in git history between implementation work and metadata cleanup.

**D4: apply prompt instructs Claude to stay on current branch and not run git**

`openspec-apply-change` skill was designed for interactive use and includes branch-creation logic. CI prompt overrides this: "stay on current branch, do NOT create or switch branches, do NOT run git commands, best effort — implement as many tasks as possible."

**D5: keep `push: branches: ['implementation/**']` trigger**

Allows developer to push locally and get the full pipeline. No risk of double-trigger from `cd-proposal-promote` because Actions bot pushes don't trigger workflows.

## Risks / Trade-offs

- **Claude hits a blocker mid-apply** → best-effort mode: tasks completed so far are committed, archive runs on partial state. Future review/fix step will handle residual tasks.
- **apply commits nothing** (all tasks already done or none applicable) → `git diff --staged --quiet` guard prevents empty commit, pipeline continues cleanly.
- **Workflow file rename** (`ci-implementation-archive` → `ci-implementation`) → any external references (docs, `gh workflow run` calls) need updating. Only one caller: `ci-proposal-promote` (being updated in this change).
