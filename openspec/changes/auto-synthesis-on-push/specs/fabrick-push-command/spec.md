## MODIFIED Requirements

### Requirement: Prompt for synthesis when auto-synthesis is disabled
The `fabrick push` command SHALL prompt the user to run synthesis after a successful push when the project's auto-synthesis setting is disabled.

#### Scenario: User confirms synthesis prompt
- **WHEN** auto-synthesis is disabled and user runs `fabrick push`
- **AND** user answers "yes" to the synthesis prompt
- **THEN** CLI sends synthesis flag to backend and runs synthesis using the same flow as manual triggers

#### Scenario: User declines synthesis prompt
- **WHEN** auto-synthesis is disabled and user runs `fabrick push`
- **AND** user answers "no" to the synthesis prompt
- **THEN** CLI skips synthesis and push completes normally

#### Scenario: Auto-synthesis enabled skips prompt
- **WHEN** auto-synthesis is enabled and user runs `fabrick push`
- **THEN** CLI does not show synthesis prompt (synthesis runs automatically via webhook)

#### Scenario: No API keys configured
- **WHEN** project has no API keys configured
- **THEN** synthesis prompt is skipped and push completes normally
