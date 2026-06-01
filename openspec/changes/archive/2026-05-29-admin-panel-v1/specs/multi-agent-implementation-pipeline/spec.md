## MODIFIED Requirements

### Requirement: Parallel build gate with attempt budget

In step 4 the orchestrator SHALL issue seven parallel `Bash` tool calls in a single response — one per app — to build `applications/backend/api`, `applications/backend/synthesis`, `applications/console`, `applications/admin`, `applications/landing`, `applications/cli`, and `applications/mcp`. If any build fails, the orchestrator SHALL invoke `build-fixer` with the failure dump. The orchestrator SHALL run AT MOST THREE build attempts (one initial parallel run plus up to two `build-fixer` iterations).

#### Scenario: All builds green on first attempt
- **WHEN** the seven parallel build calls all exit with code 0
- **THEN** the orchestrator proceeds to step 5 without invoking `build-fixer`
- **AND** no `fix: build failures for <name>` commit is produced

#### Scenario: One build fails on first attempt and is fixed on second
- **WHEN** one of the seven parallel builds fails on the first attempt
- **THEN** the orchestrator invokes `build-fixer` with the failure dump (failed app names and their error output)
- **AND** after `build-fixer` returns, the orchestrator re-runs the same seven parallel builds
- **AND** if all seven now pass, the orchestrator proceeds to step 5

#### Scenario: Builds still red after three attempts
- **WHEN** the third build attempt still leaves at least one app red
- **THEN** the orchestrator records a "partial-red: <failed apps>" flag
- **AND** the orchestrator proceeds to step 5
- **AND** the partial-red flag is surfaced in the step 7 PR body
