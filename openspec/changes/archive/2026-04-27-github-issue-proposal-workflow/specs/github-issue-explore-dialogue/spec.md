## ADDED Requirements

### Requirement: Start explore dialogue on proposal label
When a GitHub issue receives the `proposal` label, the system SHALL automatically begin an AI-assisted explore dialogue by posting a first comment and adding the `proposal:exploring` label.

#### Scenario: Issue labeled with proposal
- **WHEN** a GitHub issue is labeled with `proposal`
- **THEN** the system adds label `proposal:exploring` to the issue
- **THEN** Claude posts a comment with initial analysis of the issue body and opening questions to explore the proposal space

#### Scenario: Non-proposal issue labeled
- **WHEN** a GitHub issue is labeled with any label other than `proposal`
- **THEN** no explore workflow is triggered

### Requirement: Continue dialogue on user comment
When a user (non-bot) posts a comment on an issue with label `proposal:exploring`, the system SHALL read the full issue thread and continue the AI-assisted exploration.

#### Scenario: User replies in exploring issue
- **WHEN** a non-bot user posts a comment on an issue that has the `proposal:exploring` label
- **THEN** Claude reads the full issue thread (body + all comments)
- **THEN** Claude posts a reply that continues the exploration based on the full context

#### Scenario: Bot comment does not retrigger
- **WHEN** the GitHub Actions bot posts a comment on a `proposal:exploring` issue
- **THEN** no new explore run is triggered

#### Scenario: Concurrent comments are serialized
- **WHEN** multiple comments are posted on the same issue in quick succession
- **THEN** only one explore run executes at a time (subsequent runs cancel the previous pending run)

### Requirement: Suggest readiness when exploration is complete
When Claude determines the proposal is sufficiently explored, it SHALL signal readiness in its comment.

#### Scenario: Claude deems proposal ready
- **WHEN** Claude has gathered enough context to generate a solid proposal
- **THEN** Claude's comment includes a suggestion to add label `proposal:ready` to trigger artifact generation
