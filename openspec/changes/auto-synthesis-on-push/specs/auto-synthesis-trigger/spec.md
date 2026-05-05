## ADDED Requirements

### Requirement: Evaluate push events for synthesis triggers
The system SHALL evaluate GitHub push events against project configuration to determine if synthesis should be triggered.

#### Scenario: Auto-synthesis enabled project triggers synthesis
- **WHEN** push event is for repository with auto-synthesis enabled
- **THEN** system queues synthesis job for the project

#### Scenario: Auto-synthesis disabled project skips synthesis
- **WHEN** push event is for repository with auto-synthesis disabled
- **THEN** system logs event but does not queue synthesis

### Requirement: Map repositories to Fabrick projects
The system SHALL map GitHub repository identifiers to Fabrick project entities.

#### Scenario: Repository matches existing project
- **WHEN** push event repository matches configured project repository
- **THEN** system identifies the target Fabrick project

#### Scenario: Repository not found in projects
- **WHEN** push event repository does not match any configured project
- **THEN** system logs unmapped repository and skips processing

### Requirement: Filter based on changed files
The system SHALL analyze changed files in push commits to determine synthesis relevance.

#### Scenario: Code files changed triggers synthesis
- **WHEN** push includes changes to source code files (.ts, .js, .py, etc.)
- **THEN** system proceeds with synthesis trigger

#### Scenario: Documentation-only changes skip synthesis
- **WHEN** push only includes changes to markdown or documentation files
- **THEN** system skips synthesis based on configuration

#### Scenario: Configuration allows all changes
- **WHEN** project is configured to synthesize on all changes
- **THEN** system triggers synthesis regardless of changed file types

### Requirement: Handle multiple commits
The system SHALL process all commits in a push event to determine cumulative changes.

#### Scenario: Multiple commits analyzed together
- **WHEN** push event contains multiple commits
- **THEN** system analyzes changed files across all commits

#### Scenario: Empty commits ignored
- **WHEN** push contains commits with no file changes
- **THEN** system skips synthesis for those commits

### Requirement: Rate limiting protection
The system SHALL implement rate limiting to prevent synthesis spam from frequent pushes.

#### Scenario: Normal push frequency allowed
- **WHEN** pushes occur within configured rate limits
- **THEN** synthesis is triggered normally

#### Scenario: Excessive push frequency throttled
- **WHEN** pushes exceed configured rate limit for a project
- **THEN** synthesis requests are queued with delays or merged