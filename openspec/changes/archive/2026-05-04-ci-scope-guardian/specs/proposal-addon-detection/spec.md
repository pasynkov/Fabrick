## ADDED Requirements

### Requirement: Scope check step after proposal artifact generation
`cd-proposal-create.yml` SHALL include an AI scope-check step immediately after the `Generate proposal artifacts` step. The step SHALL compare the original issue body against the generated `proposal.md` and `tasks.md` to identify addon capabilities — capabilities not traceable to the user's original issue request.

#### Scenario: No addons detected
- **WHEN** all capabilities in the generated proposal are traceable to the original issue body
- **THEN** the scope-check step makes no changes
- **AND** the pipeline continues to the commit-and-push step normally

#### Scenario: Addon capabilities detected
- **WHEN** one or more capabilities in the generated proposal were NOT present in the original issue body (i.e., emerged from AI suggestions during explore)
- **THEN** for each addon capability:
  - A new `openspec/changes/<addon-name>/` directory is created with full artifacts (proposal.md, design.md, specs/, tasks.md)
  - A new branch `proposal/<issue>-<addon-name>` is created and pushed
  - The push auto-triggers `ci-proposal-review.yml` for the addon
- **AND** the original change's tasks.md, specs/, and proposal.md are updated to remove the addon content
- **AND** the original proposal references the split changes: "Scope note: <addon-name> split to separate proposal branch"

#### Scenario: Addon name derivation
- **WHEN** an addon capability is identified
- **THEN** its change name is derived as kebab-case from the capability name (e.g., `audit-log`, `key-rotation`)
- **AND** the branch name follows the pattern `proposal/<original-issue-number>-<addon-name>`

### Requirement: Addon detection traceability criterion
The scope-check AI step SHALL use the following criterion to classify a capability as an addon: the capability was NOT mentioned, implied, or requested in the original issue body — it was introduced by the AI during the explore dialogue.

#### Scenario: Feature explicitly requested in issue body
- **WHEN** a capability directly addresses a requirement stated in the issue body
- **THEN** it is classified as core and remains in the original change

#### Scenario: Feature suggested by AI during explore
- **WHEN** a capability was first introduced in an AI-generated explore comment (not the issue body)
- **AND** the user agreed to include it via a reply
- **THEN** it is classified as addon and extracted to a separate change
