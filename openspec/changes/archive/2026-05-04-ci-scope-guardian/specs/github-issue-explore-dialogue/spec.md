## MODIFIED Requirements

### Requirement: Continue dialogue on user comment
When a user (non-bot) posts a comment on an issue with label `proposal:exploring`, the system SHALL read the full issue thread and continue the AI-assisted exploration. When the AI introduces a suggestion not present in the original issue body, it SHALL explicitly flag it as an addon recommendation.

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

#### Scenario: AI suggests feature not in original issue body
- **WHEN** Claude identifies a potentially useful feature during exploration that was NOT mentioned in the original issue body
- **THEN** Claude marks the suggestion with `⚠️ ADDON (not in original request):` prefix
- **AND** Claude recommends: "Consider creating a separate issue for this to keep the current change focused"
- **AND** Claude does NOT assume the addon is included in scope unless the user explicitly confirms and requests it be folded in
