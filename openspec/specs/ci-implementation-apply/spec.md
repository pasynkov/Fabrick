## ADDED Requirements

### Requirement: Autonomous AI implementation on implementation branch
The implementation pipeline workflow at `.github/workflows/cd-implementation.yml` SHALL be a thin wrapper that invokes the orchestrator skill `cd-implementation-pipeline` via `anthropics/claude-code-base-action@beta` exactly once per run. The workflow SHALL NOT contain inline apply, simplify, review, build, archive, or promote steps; all stage logic SHALL live in the skill and its subagents. The orchestrator's `change-applier` subagent SHALL be the agent that runs the `openspec-apply-change` skill on the current `implementation/<name>` branch and commits its result.

#### Scenario: Workflow invokes orchestrator
- **WHEN** `cd-implementation.yml` triggers on `implementation/<name>` branch
- **THEN** the workflow runs `actions/checkout@v4` with full history, installs `@fission-ai/openspec` and root backend deps, then invokes `anthropics/claude-code-base-action@beta`
- **AND** the action's prompt instructs the model to run the `cd-implementation-pipeline` skill with `<repo>` and `<change-name>` as positional arguments
- **AND** there are no inline shell or `claude-code-base-action` steps for individual stages (apply, simplify, review, build, archive, promote)

#### Scenario: Apply commits implementation through change-applier
- **WHEN** the orchestrator reaches step 1 (apply)
- **THEN** the `change-applier` subagent invokes the `openspec-apply-change` skill for `<change-name>` on the current branch
- **AND** the agent stays on the current branch without creating new branches
- **AND** if any files changed, the agent commits `feat: apply <change-name>` directly on the current branch

#### Scenario: Apply step is skipped when no change directory exists
- **WHEN** the orchestrator runs and `openspec/changes/<name>/` does not exist
- **THEN** the orchestrator aborts the pipeline with a clear failure result
- **AND** no commits are produced

#### Scenario: Apply commits nothing on no-op
- **WHEN** the `change-applier` runs but produces no file changes
- **THEN** no `feat: apply <name>` commit is created
- **AND** the pipeline continues to step 2 (simplifier)

### Requirement: Explicit workflow dispatch from cd-proposal-promote
`cd-proposal-promote.yml` SHALL explicitly trigger `cd-implementation.yml` via `gh workflow run` after creating the `implementation/<name>` branch. The dispatched workflow file name SHALL be the renamed `cd-implementation.yml`.

#### Scenario: cd-proposal-promote triggers cd-implementation
- **WHEN** a `proposal/<name>` PR is merged to develop
- **THEN** `cd-proposal-promote` creates the `implementation/<name>` branch
- **AND** dispatches `cd-implementation.yml` on the `implementation/<name>` ref

### Requirement: Push trigger preserved for developer local pushes
`cd-implementation.yml` SHALL retain `on: push: branches: ['implementation/**']` so that a developer pushing locally to an implementation branch triggers the full pipeline.

#### Scenario: Local push triggers pipeline
- **WHEN** a developer pushes a commit to `implementation/<name>` from their local machine
- **THEN** `cd-implementation.yml` triggers automatically via the push event
- **AND** the orchestrator skill drives the full step 0 through step 7 sequence
