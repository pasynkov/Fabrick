## MODIFIED Requirements

### Requirement: Scope check step after proposal artifact generation
The `cd-proposal-pipeline` orchestrator skill SHALL include an addon-detection phase immediately after the main proposal is generated. The phase runs as step 3 of the pipeline inside the `proposal-reviewer` subagent. The subagent SHALL compare the original issue body against the generated `proposal.md` and `tasks.md` to identify addon capabilities — capabilities not traceable to the user's original issue request.

#### Scenario: No addons detected
- **WHEN** all capabilities in the generated proposal are traceable to the original issue body
- **THEN** step 3's `proposal-reviewer` subagent makes no changes to `openspec/changes/`
- **AND** the pipeline returns a single-element change list `[<main>]` to step 4

#### Scenario: Addon capabilities detected
- **WHEN** one or more capabilities in the generated proposal were NOT present in the original issue body (i.e., emerged from AI suggestions during explore)
- **THEN** for each addon capability:
  - A new `openspec/changes/<addon-name>/` directory is created with full artifacts (proposal.md, design.md, specs/, tasks.md)
- **AND** the original change's tasks.md, specs/, and proposal.md are updated to remove the addon content
- **AND** the original proposal references the split changes: "Scope note: <addon-name> split to separate proposal branch"
- **AND** step 3 returns the full change list `[<main>, <addon1>, <addon2>, …]` to step 4
- **AND** subsequent pipeline steps (4 — parallel review, 5 — branch and push, 6 — open PRs) operate on every entry in the list

#### Scenario: Addon name derivation
- **WHEN** an addon capability is identified
- **THEN** its change name is derived as kebab-case from the capability name (e.g., `audit-log`, `key-rotation`)
- **AND** the branch name created in step 5 follows the pattern `proposal/<original-issue-number>-<addon-name>`

### Requirement: Addon detection traceability criterion
The `proposal-reviewer` subagent in step 3 SHALL use the following criterion to classify a capability as an addon: the capability was NOT mentioned, implied, or requested in the original issue body — it was introduced by the AI during the explore dialogue.

#### Scenario: Feature explicitly requested in issue body
- **WHEN** a capability directly addresses a requirement stated in the issue body
- **THEN** it is classified as core and remains in the original change

#### Scenario: Feature suggested by AI during explore
- **WHEN** a capability was first introduced in an AI-generated explore comment (not the issue body)
- **AND** the user agreed to include it via a reply
- **THEN** it is classified as addon and extracted to a separate change
