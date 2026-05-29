# multi-agent-implementation-pipeline Specification

## Purpose
TBD - created by archiving change multi-agent-implementation-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Single-workflow multi-agent implementation pipeline

The implementation pipeline SHALL run end-to-end inside one GitHub Actions workflow (`cd-implementation.yml`) triggered by `push` on branches matching `implementation/**` and by `workflow_dispatch`. The workflow SHALL invoke a single `anthropics/claude-code-base-action@beta` step running the orchestrator skill `cd-implementation-pipeline` on the Opus model.

#### Scenario: Workflow triggers on implementation branch push
- **WHEN** a commit is pushed to a branch matching `implementation/**`
- **THEN** the workflow `cd-implementation.yml` starts a single job
- **AND** the job runs `actions/checkout@v4` with full history, installs `@fission-ai/openspec` and root backend deps, then invokes `anthropics/claude-code-base-action@beta` exactly once
- **AND** the action's prompt instructs the model to invoke the skill `cd-implementation-pipeline` with two positional arguments: the repository slug (`${{ github.repository }}`) and the change name derived from the branch

#### Scenario: Change-name derivation in CI
- **WHEN** the workflow runs on branch `implementation/<name>`
- **THEN** an early shell step computes `<name>` as `${GITHUB_REF#refs/heads/implementation/}`
- **AND** if no directory `openspec/changes/<name>/` exists, the step strips a leading `^[0-9]+-` numeric issue-id prefix and re-checks for the directory
- **AND** the resolved name is passed as the second positional argument to the orchestrator

#### Scenario: Workflow exposes credentials to all subagents
- **WHEN** `claude-code-base-action` runs the orchestrator
- **THEN** the action step has `GH_TOKEN` set to `secrets.GITHUB_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` set to the corresponding secret
- **AND** these env vars are inherited by every subagent invoked through the `Agent` tool

### Requirement: Orchestrator skill structure

The skill at `.claude/skills/cd-implementation-pipeline/SKILL.md` SHALL define a seven-step pipeline executed sequentially by an Opus orchestrator. The skill text SHALL describe each step's subagent, model, inputs, outputs, and failure handling. The skill SHALL accept two positional arguments — `<repo>` (in `owner/name` form) and `<change-name>` — and SHALL behave identically regardless of caller (CI workflow or a developer's local Claude Code session).

#### Scenario: Seven pipeline steps in defined order
- **WHEN** the orchestrator runs the skill
- **THEN** it executes steps 0 through 7 in order:
  - step 0 — `gh-ops` adds the label `implementation:apply` to the linked issue (issue id parsed from the change name's leading digits when present)
  - step 1 — `change-applier` runs the `openspec-apply-change` skill and commits `feat: apply <name>`
  - step 2 — `simplifier` runs the `simplify` skill and commits `refactor: simplify <name>`
  - step 3 — `reviewer` runs `review` then `review-fix` and commits `fix: review fixes for <name>`
  - step 4 — orchestrator dispatches 6 parallel `Bash` calls to build all apps; on failure, `build-fixer` runs and commits `fix: build failures for <name>`
  - step 5 — `archiver` runs `openspec-archive-change` and commits `chore: archive <name>`
  - step 6 — `git-ops` pushes `implementation/<name>`
  - step 7 — `git-ops` renames `implementation/<name>` → `feature/<name>` and pushes; `gh-ops` opens the PR to `develop`, swaps issue labels, and comments the PR URL

#### Scenario: Step ordering enforced
- **WHEN** any step's prerequisites are not satisfied (e.g. step 1 has not produced a commit yet but later steps require its output)
- **THEN** the orchestrator does not invoke later steps
- **AND** the orchestrator aborts the pipeline with a failure result

#### Scenario: Unified argv for CI and local
- **WHEN** a developer invokes `/cd-implementation-pipeline <owner/repo> <change-name>` in a local Claude Code session
- **THEN** the orchestrator runs exactly the same step sequence as it does in CI
- **AND** the orchestrator does not switch branches; it operates on the currently checked-out `implementation/<name>` branch

### Requirement: Five new doer subagents

The repository SHALL include five new subagent definition files under `.claude/agents/`, one per doer role. Each file SHALL declare its model and allowed tools in frontmatter and document its responsibilities, tool boundaries, file-edit scope, test-edit scope, and commit-message contract in the body.

#### Scenario: change-applier agent contract
- **WHEN** `.claude/agents/change-applier.md` is loaded
- **THEN** its frontmatter declares a model and its allowed tools include `Bash`, `Read`, `Write`, `Edit`, `Skill`
- **AND** the body instructs the agent to invoke the `openspec-apply-change` skill for the change name passed in the prompt
- **AND** the body permits adding and modifying e2e tests as required by the change
- **AND** the body forbids editing any file under `.github/workflows/`
- **AND** the body requires running `cd applications/backend/api && npm run test:e2e` to green before committing
- **AND** the body specifies the commit message `feat: apply <name>`

#### Scenario: simplifier agent contract
- **WHEN** `.claude/agents/simplifier.md` is loaded
- **THEN** its frontmatter declares a model and its allowed tools include `Bash`, `Read`, `Write`, `Edit`, `Skill`
- **AND** the body instructs the agent to invoke the `simplify` skill
- **AND** the body forbids editing any test file (paths matching `*.spec.ts`, `*.test.ts`, `*.e2e.ts`, or any file under `**/test/**`)
- **AND** the body forbids editing any file under `.github/workflows/`
- **AND** the body requires running `cd applications/backend/api && npm run test:e2e` to green before committing
- **AND** the body specifies the commit message `refactor: simplify <name>`

#### Scenario: reviewer agent contract
- **WHEN** `.claude/agents/reviewer.md` is loaded
- **THEN** its frontmatter declares a model and its allowed tools include `Bash`, `Read`, `Write`, `Edit`, `Skill`
- **AND** the body instructs the agent to invoke the `review` skill followed by the `review-fix` skill
- **AND** the body forbids editing any test file
- **AND** the body forbids editing any file under `.github/workflows/`
- **AND** the body instructs the agent to validate that the `change-applier`'s commit added tests for any new behavioural functionality and modified existing tests only when the change specifications explicitly required it
- **AND** the body specifies that on a detected TDD gap the agent SHALL return a reply prefixed `ERROR: TDD gap on <task-refs>` and SHALL NOT add the missing tests itself
- **AND** the body requires running `cd applications/backend/api && npm run test:e2e` to green before committing
- **AND** the body specifies the commit message `fix: review fixes for <name>`

#### Scenario: build-fixer agent contract
- **WHEN** `.claude/agents/build-fixer.md` is loaded
- **THEN** its frontmatter declares a model and its allowed tools include `Bash`, `Read`, `Write`, `Edit`, `Skill`
- **AND** the body instructs the agent to fix source code so the failed builds pass
- **AND** the body permits minor test edits if a test file is itself the cause of the build failure
- **AND** the body forbids editing `package.json`, `tsconfig.json`, any file under `.github/workflows/`, or any build-config file
- **AND** the body instructs the agent to re-run only the builds that were failing, using the commands listed in the orchestrator's prompt
- **AND** the body specifies the commit message `fix: build failures for <name>`

#### Scenario: archiver agent contract
- **WHEN** `.claude/agents/archiver.md` is loaded
- **THEN** its frontmatter declares a model and its allowed tools include `Bash`, `Read`, `Write`, `Edit`, `Skill`
- **AND** the body instructs the agent to invoke the `openspec-archive-change` skill non-interactively, skipping the delta-spec sync prompt and proceeding even if some artifacts or tasks are incomplete
- **AND** the body forbids using the `AskUserQuestion` tool
- **AND** the body permits filesystem mutation only under `openspec/changes/` and `openspec/changes/archive/`
- **AND** the body specifies the commit message `chore: archive <name>`

#### Scenario: Doers do not recurse or shell out to gh
- **WHEN** any of the five doer agents runs
- **THEN** it does not invoke the `Agent` tool
- **AND** it does not call `gh` directly; all label, comment, and PR operations are delegated to `gh-ops` via the orchestrator

### Requirement: Doer agents own their commits

Each of the five doer subagents SHALL commit its own work using `git add -A && git commit -m "<message> <name>"` before returning. The orchestrator SHALL NOT batch commits across stages and SHALL NOT invoke `git-ops` for the stage commits.

#### Scenario: Per-stage commit
- **WHEN** the change-applier finishes a successful run on branch `implementation/<name>`
- **THEN** the agent has produced exactly one commit with subject `feat: apply <name>` on the current branch
- **WHEN** the simplifier finishes a successful run
- **THEN** the agent has produced exactly one commit with subject `refactor: simplify <name>` on the current branch
- **WHEN** the reviewer finishes a successful run
- **THEN** the agent has produced exactly one commit with subject `fix: review fixes for <name>` on the current branch
- **WHEN** the build-fixer finishes a successful run after a build failure
- **THEN** the agent has produced one commit with subject `fix: build failures for <name>` on the current branch
- **WHEN** the archiver finishes a successful run
- **THEN** the agent has produced one commit with subject `chore: archive <name>` on the current branch

#### Scenario: No commit when no changes
- **WHEN** a doer runs and produces no file changes
- **THEN** the agent does not create an empty commit
- **AND** the agent returns a summary noting "no changes"

### Requirement: Orchestrator passes only summaries between steps

The orchestrator SHALL NOT validate the work product of any doer. It SHALL accept a short summary from each doer's return value and use that summary to decide whether to proceed, retry, abort, or bounce. The orchestrator SHALL detect failure by checking whether the doer's reply starts with the literal token `ERROR:`.

#### Scenario: Successful doer reply
- **WHEN** a doer returns a reply that does NOT start with `ERROR:`
- **THEN** the orchestrator treats the step as successful and proceeds to the next step
- **AND** the orchestrator does not inspect the produced diff or re-run tests

#### Scenario: Failed doer reply
- **WHEN** a doer returns a reply that starts with `ERROR:`
- **THEN** the orchestrator treats the step as failed and applies the per-step retry policy

### Requirement: Stage-skip via git log and archive directory

The orchestrator SHALL skip stages that have already produced their canonical commit (or, for archive, their canonical directory). The check SHALL run once at the start of the pipeline and the result SHALL drive whether each step is invoked.

#### Scenario: Apply skip
- **WHEN** the pipeline starts on a branch whose `git log` contains a commit with subject `feat: apply <name>`
- **THEN** the orchestrator SKIPS step 1 (change-applier)

#### Scenario: Simplify skip
- **WHEN** the pipeline starts on a branch whose `git log` contains a commit with subject `refactor: simplify <name>`
- **THEN** the orchestrator SKIPS step 2 (simplifier)

#### Scenario: Review skip
- **WHEN** the pipeline starts on a branch whose `git log` contains a commit with subject `fix: review fixes for <name>`
- **THEN** the orchestrator SKIPS step 3 (reviewer)

#### Scenario: Archive skip
- **WHEN** the pipeline starts on a repository in which a directory matching the glob `openspec/changes/archive/*-<name>` exists
- **THEN** the orchestrator SKIPS step 5 (archiver)

### Requirement: TDD-bounce policy

If the `reviewer` returns `ERROR: TDD gap on <task-refs>`, the orchestrator SHALL re-spawn `change-applier` with the gap hint and SHALL then re-run `reviewer`. The orchestrator SHALL allow at most ONE bounce per pipeline run. A second unresolved TDD gap SHALL be recorded as a "TDD gap unresolved" line in the final PR comment and the pipeline SHALL proceed to step 4.

#### Scenario: First TDD gap triggers one applier-reviewer cycle
- **WHEN** the reviewer in step 3 returns `ERROR: TDD gap on <task-refs>` on its first run of the pipeline
- **THEN** the orchestrator re-invokes `change-applier` with a prompt that includes the TDD gap hint
- **AND** the orchestrator then re-invokes `reviewer` for the second-pass review

#### Scenario: Second TDD gap is logged and the pipeline continues
- **WHEN** the reviewer in step 3 returns `ERROR: TDD gap on <task-refs>` again on the second-pass review
- **THEN** the orchestrator records "TDD gap unresolved: <task-refs>" for inclusion in the final PR comment
- **AND** the orchestrator proceeds to step 4 without further bounces

#### Scenario: Reviewer crash is separate from TDD signal
- **WHEN** the reviewer's `Agent` invocation returns an error result (tool failure, timeout) rather than an `ERROR: TDD gap` domain reply
- **THEN** the orchestrator applies the per-step retry policy for step 3, not the TDD-bounce policy

### Requirement: Parallel build gate with attempt budget

In step 4 the orchestrator SHALL issue six parallel `Bash` tool calls in a single response — one per app — to build `applications/backend/api`, `applications/backend/synthesis`, `applications/console`, `applications/landing`, `applications/cli`, and `applications/mcp`. If any build fails, the orchestrator SHALL invoke `build-fixer` with the failure dump. The orchestrator SHALL run AT MOST THREE build attempts (one initial parallel run plus up to two `build-fixer` iterations).

#### Scenario: All builds green on first attempt
- **WHEN** the six parallel build calls all exit with code 0
- **THEN** the orchestrator proceeds to step 5 without invoking `build-fixer`
- **AND** no `fix: build failures for <name>` commit is produced

#### Scenario: One build fails on first attempt and is fixed on second
- **WHEN** one of the six parallel builds fails on the first attempt
- **THEN** the orchestrator invokes `build-fixer` with the failure dump (failed app names and their error output)
- **AND** after `build-fixer` returns, the orchestrator re-runs the same six parallel builds
- **AND** if all six now pass, the orchestrator proceeds to step 5

#### Scenario: Builds still red after three attempts
- **WHEN** the third build attempt still leaves at least one app red
- **THEN** the orchestrator records a "partial-red: <failed apps>" flag
- **AND** the orchestrator proceeds to step 5
- **AND** the partial-red flag is surfaced in the step 7 PR body

### Requirement: Per-step retry policy

Each pipeline step except step 4 (which uses the build-attempt budget) SHALL be attempted at most twice (one initial attempt plus one retry on failure). After the second failed attempt, the orchestrator SHALL follow the per-step failure path below.

#### Scenario: Step 0 second failure warns and continues
- **WHEN** both attempts of step 0 (`gh-ops` label) fail
- **THEN** the orchestrator records a warning and proceeds to step 1
- **AND** the issue may remain without the `implementation:apply` label

#### Scenario: Step 1 second failure aborts the pipeline
- **WHEN** both attempts of step 1 (`change-applier`) fail
- **THEN** the orchestrator aborts the pipeline with a failure result
- **AND** the job exits non-zero

#### Scenario: Step 2 second failure warns and continues
- **WHEN** both attempts of step 2 (`simplifier`) fail
- **THEN** the orchestrator records a warning and proceeds to step 3
- **AND** no `refactor: simplify <name>` commit exists on the branch

#### Scenario: Step 3 reviewer crash on second failure aborts
- **WHEN** both attempts of step 3 (`reviewer`) fail with a crash (not a `ERROR: TDD gap` domain reply)
- **THEN** the orchestrator aborts the pipeline with a failure result

#### Scenario: Step 5 second failure aborts
- **WHEN** both attempts of step 5 (`archiver`) fail
- **THEN** the orchestrator aborts the pipeline with a failure result
- **AND** no promote step runs

#### Scenario: Step 6 second failure aborts
- **WHEN** both attempts of step 6 (`git-ops` push) fail
- **THEN** the orchestrator aborts the pipeline with a failure result

#### Scenario: Step 7 second failure warns
- **WHEN** both attempts of step 7 (promoter) fail
- **THEN** the orchestrator records a warning naming the failed sub-step (branch rename, PR open, label swap, or comment)
- **AND** the job may exit zero if the branch was renamed but the PR was not opened (developer can open the PR manually)

### Requirement: Promote step folded into pipeline

Step 7 of the pipeline SHALL perform the promote operation that was previously a separate `promote` GitHub Actions job. The promote SHALL:
1. Create the branch `feature/<name>` from the current `implementation/<name>` tip via `git-ops`.
2. Push `feature/<name>` to the origin via `git-ops`.
3. Delete the `implementation/<name>` branch on the origin via `git-ops`.
4. Open a PR from `feature/<name>` to `develop` via `gh-ops`, idempotently (re-use an existing open PR if present).
5. Remove the label `implementation:apply` from the linked issue and add `implementation:ready` via `gh-ops` (idempotent).
6. Comment the PR URL on the linked issue via `gh-ops`.

#### Scenario: Successful promote
- **WHEN** step 7 runs after all prior steps succeed
- **THEN** the branch `feature/<name>` exists on origin
- **AND** the branch `implementation/<name>` is deleted on origin
- **AND** a PR from `feature/<name>` to `develop` exists (newly opened or pre-existing and re-used)
- **AND** the linked issue has label `implementation:ready` and not `implementation:apply`
- **AND** the linked issue has a comment containing the PR URL

#### Scenario: Promote runs after a partial-red build
- **WHEN** step 4 ended with a `partial-red` flag and step 7 runs
- **THEN** the PR body includes the partial-red flag and the names of the failing apps
- **AND** the pipeline still completes step 7

#### Scenario: No issue id in change name
- **WHEN** the change name has no leading numeric issue id
- **THEN** the orchestrator skips the issue label and comment operations in step 7
- **AND** the branch rename and PR open still run

### Requirement: Fixtures for local dry-run

The skill directory SHALL include a `fixtures/` subdirectory with at least:
- `fixtures/sample-branch.md` — a short text fixture describing a sample branch name and the expected derived `<change-name>`.
- `fixtures/sample-change/` — a minimal `openspec/changes/<name>/` tree (with `proposal.md`, `design.md`, `tasks.md`, and at least one `specs/<capability>/spec.md`) that a developer can use to smoke-test the orchestrator locally.

#### Scenario: Sample branch fixture
- **WHEN** a developer reads `.claude/skills/cd-implementation-pipeline/fixtures/sample-branch.md`
- **THEN** the file shows at least one branch-to-change-name derivation example, including the leading-issue-id stripping case

#### Scenario: Sample change fixture is structurally valid
- **WHEN** a developer copies `.claude/skills/cd-implementation-pipeline/fixtures/sample-change/` under `openspec/changes/` and runs `openspec status --change <name>`
- **THEN** the change is recognised and reports its artifact set as complete
