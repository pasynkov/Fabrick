## ADDED Requirements

### Requirement: Autonomous AI implementation on implementation branch
The `ci-implementation.yml` workflow SHALL include an `apply` job that runs before `archive`. The job SHALL use `claude-code-base-action@beta` with model `claude-sonnet-4-6` to invoke the `openspec-apply-change` skill on the current `implementation/<name>` branch. The job SHALL commit any resulting file changes before the archive job begins.

#### Scenario: Apply runs and commits implementation
- **WHEN** `ci-implementation.yml` triggers on `implementation/<name>` branch
- **THEN** the `apply` job runs `claude-code-base-action` with the openspec-apply-change skill for the change name derived from the branch
- **AND** Claude implements tasks staying on the current branch without creating new branches
- **AND** if any files changed, a commit `feat: implement <name>` is pushed before archive runs

#### Scenario: Apply job skips when no change directory exists
- **WHEN** `ci-implementation.yml` triggers on `implementation/<name>` branch
- **AND** `openspec/changes/<name>/` directory does not exist
- **THEN** the apply step is skipped
- **AND** archive and promote jobs continue normally

#### Scenario: Apply commits nothing on no-op
- **WHEN** Claude runs apply but makes no file changes
- **THEN** no empty commit is created
- **AND** the pipeline continues to archive without error

### Requirement: Explicit workflow dispatch from cd-proposal-promote
`cd-proposal-promote.yml` SHALL explicitly trigger `ci-implementation.yml` via `gh workflow run` after creating the `implementation/<name>` branch, because GitHub Actions does not propagate push events from bot-authored pushes.

#### Scenario: cd-proposal-promote triggers ci-implementation
- **WHEN** a `proposal/<name>` PR is merged to develop
- **THEN** `cd-proposal-promote` creates `implementation/<name>` branch
- **AND** dispatches `ci-implementation.yml` on `implementation/<name>` ref

### Requirement: Push trigger preserved for developer local pushes
`ci-implementation.yml` SHALL retain `on: push: branches: ['implementation/**']` so that a developer pushing locally to an implementation branch triggers the full pipeline.

#### Scenario: Local push triggers pipeline
- **WHEN** a developer pushes a commit to `implementation/<name>` from their local machine
- **THEN** `ci-implementation.yml` triggers automatically via the push event
- **AND** the apply → archive → promote sequence runs
