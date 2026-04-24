## ADDED Requirements

### Requirement: Generate proposal artifacts from issue thread
When a `proposal:ready` label is added to an issue, the system SHALL read the full issue thread and generate OpenSpec proposal artifacts using `/openspec-propose`.

#### Scenario: Label proposal:ready added
- **WHEN** the `proposal:ready` label is added to an issue that has `proposal:exploring`
- **THEN** Claude reads the full issue thread (body + all comments)
- **THEN** Claude derives a kebab-case change name from the issue title and discussion content
- **THEN** Claude runs `/openspec-propose <name>` to generate `proposal.md`, `design.md`, `specs/`, and `tasks.md` artifacts

#### Scenario: Name is derived from discussion context
- **WHEN** the issue title or discussion has evolved beyond the original title
- **THEN** Claude uses the most accurate kebab-case name reflecting the final agreed scope, not just the raw issue title slug

### Requirement: Push proposal branch with issue reference
After generating artifacts, the system SHALL create and push a `proposal/<name>` branch with a commit that references the source GitHub issue.

#### Scenario: Branch created and pushed
- **WHEN** OpenSpec artifacts are generated successfully
- **THEN** the system creates branch `proposal/<name>` from the current default branch
- **THEN** the system commits all generated artifacts with message: `proposal: <name>\n\nrefs #<issue-number>`
- **THEN** the system pushes the branch to origin

#### Scenario: Existing ci-proposal-review fires
- **WHEN** the `proposal/<name>` branch is pushed
- **THEN** the existing `ci-proposal-review.yml` workflow fires automatically (no changes needed to that workflow)

### Requirement: Post result comment on issue
After pushing the branch, the system SHALL post a comment on the issue with a link to the branch and the auto-opened PR.

#### Scenario: Branch push succeeds
- **WHEN** `proposal/<name>` branch is pushed successfully
- **THEN** Claude posts a comment on the issue with the branch name and a link to the PR opened by `ci-proposal-review`
