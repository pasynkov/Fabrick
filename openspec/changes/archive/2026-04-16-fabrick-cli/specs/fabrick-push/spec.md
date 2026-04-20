## MODIFIED Requirements

### Requirement: Skill delegates to CLI
The skill SHALL instruct the user to run `fabrick push` via the CLI instead of executing curl directly.

#### Scenario: CLI is installed
- **WHEN** user invokes the `fabrick-push` skill in Claude Code
- **THEN** the skill runs `fabrick push` in the terminal and reports the result

#### Scenario: CLI is not installed
- **WHEN** `fabrick push` command is not found
- **THEN** the skill reports: "fabrick not installed. Run: `npm install -g fabrick`"
