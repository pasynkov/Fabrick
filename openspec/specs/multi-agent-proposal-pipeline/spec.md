# multi-agent-proposal-pipeline Specification

## Purpose
TBD - created by archiving change multi-agent-proposal-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Single-workflow multi-agent pipeline

The proposal-creation pipeline SHALL run end-to-end inside one GitHub Actions workflow (`cd-proposal-create.yml`) triggered by `issues.labeled` for the `proposal:ready` label. The workflow SHALL invoke a single `claude-code-base-action` step running the orchestrator skill `cd-proposal-pipeline` on the Opus model with a 45-minute timeout.

#### Scenario: Workflow triggers on proposal:ready label
- **WHEN** the `proposal:ready` label is added to an issue
- **THEN** the workflow `cd-proposal-create.yml` starts a single job
- **AND** the job runs `actions/checkout@v4`, installs `@fission-ai/openspec`, then invokes `anthropics/claude-code-base-action@beta` exactly once
- **AND** the action's prompt instructs the model to invoke the skill `cd-proposal-pipeline` with two positional arguments: the repository slug (`${{ github.repository }}`) and the issue number (`${{ github.event.issue.number }}`)

#### Scenario: No separate review workflow runs on branch push
- **WHEN** the pipeline pushes branches matching `proposal/**`
- **THEN** no `ci-proposal-review.yml` workflow fires
- **AND** review for those branches has already been performed inside the same pipeline run (step 4)

#### Scenario: Workflow exposes credentials to all subagents
- **WHEN** `claude-code-base-action` runs the orchestrator
- **THEN** the action step has `GH_TOKEN` set to `secrets.GITHUB_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` set to the corresponding secret
- **AND** the env vars are inherited by every subagent invoked through the `Agent` tool

### Requirement: Orchestrator skill structure

The skill at `.claude/skills/cd-proposal-pipeline/SKILL.md` SHALL define a six-step pipeline executed sequentially by an Opus orchestrator. The skill text SHALL describe each step's subagent, model, inputs, outputs, and failure handling.

The skill SHALL accept two positional arguments — `<repo>` (in `owner/name` form) and `<issue-number>` — and SHALL behave identically regardless of caller (CI workflow or a developer's local Claude Code session).

#### Scenario: Six pipeline steps in defined order
- **WHEN** the orchestrator runs the skill
- **THEN** it executes steps 0 through 6 in order:
  - step 0 — `gh-ops` fetches the issue thread (body + comments)
  - step 1 — `proposal-author` generates the main proposal artifacts and returns the change name and a summary
  - step 2 — `gh-ops` posts the summary as a comment and adds the label `proposal:proposing`
  - step 3 — `proposal-reviewer` reviews the main proposal, extracts addons, and returns the list of all change directory names
  - step 4 — `proposal-reviewer` reviews every change directory in parallel and returns per-directory review notes
  - step 5 — `git-ops` creates and pushes one branch per change directory
  - step 6 — `gh-ops` opens one PR per branch with the review notes as the body, labels each PR, and updates issue labels

#### Scenario: Step ordering enforced
- **WHEN** any step's prerequisites are not satisfied (e.g. step 1 has not produced a change name yet)
- **THEN** the orchestrator does not invoke later steps
- **AND** the orchestrator aborts the pipeline with a failure result

### Requirement: Custom subagent definitions

The repository SHALL include four custom subagent definition files under `.claude/agents/`, one per role, each declaring its model and allowed tools in frontmatter.

#### Scenario: gh-ops agent contract
- **WHEN** `.claude/agents/gh-ops.md` is loaded
- **THEN** its frontmatter declares `model: claude-haiku-4-5-20251001`
- **AND** its allowed tools include `Bash(gh *)`, `Read`, `Write`
- **AND** its body documents its responsibilities: fetching issue threads, posting issue/PR comments, adding/removing labels
- **AND** every `gh` invocation it makes uses `--repo <repo>` with the repository slug supplied by the orchestrator

#### Scenario: git-ops agent contract
- **WHEN** `.claude/agents/git-ops.md` is loaded
- **THEN** its frontmatter declares `model: claude-haiku-4-5-20251001`
- **AND** its allowed tools include `Bash(git *)`, `Read`
- **AND** its body forbids any use of `gh` or filesystem mutation outside `openspec/changes/`

#### Scenario: proposal-author agent contract
- **WHEN** `.claude/agents/proposal-author.md` is loaded
- **THEN** its frontmatter declares `model: claude-opus-4-7`
- **AND** its allowed tools include `Skill`, `Bash`, `Read`, `Write`, `Edit`
- **AND** its body instructs it to invoke the `openspec-propose` skill to generate artifacts

#### Scenario: proposal-reviewer agent contract
- **WHEN** `.claude/agents/proposal-reviewer.md` is loaded
- **THEN** its frontmatter declares `model: claude-sonnet-4-6`
- **AND** its allowed tools include `Skill`, `Read`, `Edit`, `Write`, `Bash(gh *)`, `Bash(rm -rf openspec/*)`
- **AND** its body instructs it to invoke the `review-proposal` skill and identifies which step (3 or 4) it is being called for

### Requirement: Parallel review fan-out

In step 4 of the pipeline, the orchestrator SHALL issue one `Agent` invocation per change directory (main + each addon) within a single response, so that all reviews run in parallel.

#### Scenario: N change directories trigger N parallel reviews
- **WHEN** step 3 returns a list of change directory names of length N
- **THEN** step 4's orchestrator response contains exactly N `Agent` tool calls in one tool-use block
- **AND** every call's `subagent_type` is `proposal-reviewer`
- **AND** every call's prompt scopes the reviewer to a single change directory under `openspec/changes/<name>/`

#### Scenario: Reviewer scoped to single directory
- **WHEN** a `proposal-reviewer` agent is invoked in step 4
- **THEN** its prompt instructs it to read, edit, and write only inside `openspec/changes/<name>/`
- **AND** it is forbidden from modifying any sibling change directory

### Requirement: Per-step retry budget

Each pipeline step SHALL be attempted at most twice (one initial attempt plus one retry on failure). After the second failed attempt, the orchestrator SHALL abort the pipeline with a failure result, except where Decision 4 of `design.md` specifies a step-specific partial-completion path (steps 4, 5, and 6).

#### Scenario: First attempt succeeds
- **WHEN** a subagent call returns a successful result on its first attempt
- **THEN** the orchestrator records the result and proceeds to the next step

#### Scenario: First attempt fails, retry succeeds
- **WHEN** a subagent call returns an error result on its first attempt
- **THEN** the orchestrator re-invokes the same subagent once with the same prompt
- **AND** if the retry succeeds, the orchestrator proceeds to the next step

#### Scenario: Both attempts fail in steps 0–3
- **WHEN** both attempts of a step in {0, 1, 2, 3} fail
- **THEN** the orchestrator aborts the pipeline and the workflow job exits non-zero
- **AND** issue labels are not rolled back automatically

#### Scenario: Partial failure in step 4
- **WHEN** one of N parallel reviews in step 4 fails on both attempts
- **THEN** the orchestrator records the failure as a placeholder review note for that directory
- **AND** the remaining steps continue normally, with the failure surfaced in the step 6 PR comment for that directory

#### Scenario: Partial failure in step 5 or 6
- **WHEN** one of the N iterations of step 5 or step 6 fails on both attempts
- **THEN** the orchestrator records which iterations succeeded
- **AND** the orchestrator continues with the remaining successful entries
- **AND** the orchestrator surfaces the failure in the final job log and (where possible) on the issue

### Requirement: No-staging git branching in step 5

The `git-ops` subagent in step 5 SHALL create one branch per change directory using selective `git add` and SHALL NOT use `git stash`, `/tmp` staging, or any out-of-tree state.

#### Scenario: Branch per change directory
- **WHEN** step 5 runs for change directories `[main, addon1, addon2]` with issue number `N`
- **THEN** the agent executes for each name `X`:
  - `git checkout develop`
  - `git checkout -b "proposal/${N}-${X}"`
  - `git add "openspec/changes/${X}/"`
  - `git commit -m "proposal: ${X}" -m "refs #${N}"`
  - `git push origin "proposal/${N}-${X}"`
- **AND** untracked sibling directories remain in the working tree across iterations

#### Scenario: Selective git add isolates branches
- **WHEN** branch `proposal/N-main` is pushed
- **THEN** the remote branch contains `openspec/changes/main/` only
- **AND** does not contain any addon directory committed to the branch

### Requirement: Inline state passing between subagents

The orchestrator SHALL pass state between subagents through the orchestrator's conversation context (subagent return values and prompt text) and SHALL NOT write `/tmp/*.md` or `/tmp/*.json` files for text state. The only filesystem state used for handoff is the `openspec/changes/<name>/` tree.

#### Scenario: Issue thread inline
- **WHEN** step 0's `gh-ops` agent returns the issue thread
- **THEN** the orchestrator receives the JSON as text in the subagent's return value
- **AND** passes the JSON inline in the prompt to the step 1 `proposal-author` agent

#### Scenario: Change names inline
- **WHEN** step 3's `proposal-reviewer` returns the list of change directory names
- **THEN** the orchestrator receives the list as text
- **AND** passes each name inline as a `subagent_type` argument and prompt argument for steps 4, 5, and 6

### Requirement: Issue thread truncation when oversized

The `gh-ops` subagent in step 0 SHALL truncate the issue thread JSON if its size exceeds the threshold defined in the skill (provisionally 30 KB or 50 comments). Oldest comments SHALL be dropped first; the issue body SHALL always be preserved in full.

#### Scenario: Thread below threshold
- **WHEN** the issue body and all comments together fit within the threshold
- **THEN** `gh-ops` returns the full thread JSON unchanged

#### Scenario: Thread above threshold
- **WHEN** the combined size exceeds the threshold
- **THEN** `gh-ops` drops the oldest comments until the JSON fits the threshold
- **AND** the returned JSON includes a `truncated: true` field indicating that older comments were omitted
- **AND** the issue body is preserved verbatim

### Requirement: New pipeline-phase labels

The pipeline SHALL apply four GitHub labels to record phase and PR type. These labels SHALL exist in the repository before the pipeline runs: `proposal:proposing`, `feature`, `main`, `addon`.

#### Scenario: proposal:proposing applied after summary comment
- **WHEN** step 2 completes successfully
- **THEN** the issue has label `proposal:proposing`

#### Scenario: feature replaces every proposal:* label after PRs open
- **WHEN** step 6 completes successfully
- **THEN** the issue has label `feature`
- **AND** the issue has no label whose name starts with `proposal:` (including `proposal:exploring`, `proposal:ready`, `proposal:proposing`)

#### Scenario: PRs labelled main or addon
- **WHEN** step 6 opens a PR for the main proposal directory
- **THEN** the PR has label `main`
- **WHEN** step 6 opens a PR for an extracted addon directory
- **THEN** the PR has label `addon`

### Requirement: Affected-components analysis in summary

The `proposal-author` subagent SHALL include an "Affected components" section in the summary block it returns from step 1. The section SHALL group touched surfaces by tier and name the concrete services/apps/directories per tier. The same block (verbatim) SHALL be used as the body of the step 2 issue comment and as the lead block of every PR body produced in step 6.

#### Scenario: Components grouped by tier
- **WHEN** `proposal-author` returns its summary
- **THEN** the summary contains a section titled "Affected components"
- **AND** the section lists components grouped under tier headings drawn from at least `Frontend:`, `Backend:`, `Infra:` (additional project-specific tiers like `CLI:`, `Workflows:` MAY appear when relevant)
- **AND** each tier line names concrete service/app/directory identifiers, not file paths
- **AND** the total components section length is ≤ 6 lines

#### Scenario: Components reused in issue comment and PR body
- **WHEN** step 2 posts its summary comment on the issue
- **THEN** the comment body contains the "Affected components" section unchanged
- **WHEN** step 6 opens a PR for any change directory
- **THEN** the PR body begins with the "Affected components" section unchanged, followed by the per-directory review notes from step 4

### Requirement: Test-first tasks enforced in pipeline

The `proposal-author` subagent SHALL produce `tasks.md` with test-first ordering for every behavioural capability in the change: a write-or-modify-failing-test task SHALL precede the implementation task it covers. The `proposal-reviewer` subagent in mode 4 SHALL verify the ordering and SHALL insert any missing test task immediately before the related implementation task.

#### Scenario: Author emits TDD-ordered tasks
- **WHEN** `proposal-author` generates `tasks.md` for a behavioural capability
- **THEN** the first task for that capability is a test task (unit, integration, or e2e as appropriate to the capability surface) phrased as "write failing test" or "modify existing test to cover X (now failing)"
- **AND** the implementation tasks for the capability appear after the test task

#### Scenario: Author flags non-behavioural tasks as no-test
- **WHEN** a task is purely mechanical (rename, doc-only, label-only, workflow YAML rewrite)
- **THEN** the task line carries the suffix `[no-test]` and a parenthetical one-line rationale

#### Scenario: Reviewer inserts missing test tasks in mode 4
- **WHEN** `proposal-reviewer` in mode 4 finds a behavioural task in `tasks.md` not preceded by a test task and not flagged `[no-test]`
- **THEN** the reviewer inserts a test task immediately above it, naming the test surface (unit / integration / e2e) and the behaviour under test
- **AND** the reviewer's returned review note records the insertion

#### Scenario: Reviewer accepts plausible no-test rationale
- **WHEN** a task is flagged `[no-test]` with a rationale
- **AND** the rationale plausibly applies (e.g. the task body matches doc-only, rename-only, or workflow-YAML-only criteria)
- **THEN** the reviewer leaves the task unchanged

### Requirement: Concurrency group prevents overlap

The workflow `cd-proposal-create.yml` SHALL declare a `concurrency` group keyed by issue number to prevent two pipeline runs for the same issue from interleaving.

#### Scenario: Two label events for the same issue
- **WHEN** the `proposal:ready` label is added twice on issue `N` in rapid succession
- **THEN** the first run holds the concurrency group `proposal-pipeline-N`
- **AND** the second run waits for the first to finish (`cancel-in-progress: false`)

