## Purpose

End-to-end pipeline that converts a GitHub issue labelled `proposal:ready` into one or more `proposal/<issue>-<name>` branches with OpenSpec artifacts and auto-opened PRs.
## Requirements
### Requirement: Generate proposal artifacts from issue thread
When a `proposal:ready` label is added to an issue, the system SHALL run the `cd-proposal-pipeline` orchestrator skill, which reads the full issue thread and invokes the `proposal-author` subagent to generate OpenSpec proposal artifacts using `/openspec-propose`.

#### Scenario: Label proposal:ready added
- **WHEN** the `proposal:ready` label is added to an issue that has `proposal:exploring`
- **THEN** the workflow `cd-proposal-create.yml` triggers and invokes the orchestrator skill `cd-proposal-pipeline`
- **THEN** the orchestrator's step 0 (`gh-ops` subagent) fetches the full issue thread (body + all comments)
- **THEN** the orchestrator's step 1 (`proposal-author` subagent) derives a kebab-case change name from the issue title and discussion content and invokes the `openspec-propose` skill
- **THEN** `openspec-propose` generates `proposal.md`, `design.md`, `specs/`, and `tasks.md` artifacts under `openspec/changes/<name>/`

#### Scenario: Name is derived from discussion context
- **WHEN** the issue title or discussion has evolved beyond the original title
- **THEN** the `proposal-author` subagent uses the most accurate kebab-case name reflecting the final agreed scope, not just the raw issue title slug

### Requirement: Push proposal branch with issue reference
After generating artifacts, the pipeline SHALL create and push a `proposal/<issue-number>-<name>` branch for the main proposal (and for each extracted addon) with a commit that references the source GitHub issue. Branch creation runs in step 5 of the pipeline via the `git-ops` subagent.

#### Scenario: Branch created and pushed
- **WHEN** OpenSpec artifacts are generated successfully and the parallel review step (step 4) completes
- **THEN** the `git-ops` subagent in step 5 creates branch `proposal/<issue-number>-<name>` from the workflow's default checkout ref
- **THEN** the `git-ops` subagent commits all generated artifacts for that change directory with message: `proposal: <name>\n\nrefs #<issue-number>`
- **THEN** the `git-ops` subagent pushes the branch to origin

#### Scenario: No external review workflow fires on branch push
- **WHEN** a `proposal/<name>` branch is pushed
- **THEN** no `ci-proposal-review.yml` workflow exists in the repository to fire
- **AND** review for the branch has already been performed inside the same pipeline run (step 4)

### Requirement: Post result comment on issue
After opening PRs, the pipeline SHALL post a comment on the issue with links to the auto-opened PRs and a summary of the proposal scope. Comment posting runs in step 6 of the pipeline via the `gh-ops` subagent.

#### Scenario: PRs opened successfully
- **WHEN** step 5 pushes one or more `proposal/<issue-number>-<name>` branches and step 6 opens PRs for them
- **THEN** the `gh-ops` subagent posts a comment on the issue listing each PR URL
- **AND** the comment begins with the "Affected components" section returned by `proposal-author` in step 1
- **AND** for each PR, the comment includes the review notes returned by step 4 for that directory

### Requirement: Replace proposal labels with feature on PR open
After step 6 opens the PRs, the pipeline SHALL strip every `proposal:*` label from the source issue and apply the `feature` label.

#### Scenario: Issue transitions from proposing to feature
- **WHEN** step 6 has opened a PR for at least one change directory
- **THEN** the `gh-ops` subagent removes every label whose name starts with `proposal:` from the issue
- **AND** adds the `feature` label
- **AND** the call is idempotent: re-running it leaves the label state unchanged

