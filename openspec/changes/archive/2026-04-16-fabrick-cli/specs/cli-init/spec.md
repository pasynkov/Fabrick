## ADDED Requirements

### Requirement: Interactive project initialization
The system SHALL provide a `fabrick init` command that interactively bootstraps a Fabrick project in the current working directory.

#### Scenario: Successful init in a new project
- **WHEN** user runs `fabrick init` in a directory without `.fabrick/`
- **THEN** the CLI prompts for AI tool selection (Claude Code only), prompts for project name (defaulting to folder name), creates `.fabrick/config.yaml`, and copies skills into `.claude/skills/`

#### Scenario: Project name defaults to folder name
- **WHEN** user runs `fabrick init` and presses Enter without typing a project name
- **THEN** the CLI uses the current folder name as both `project` and `repo` in config

#### Scenario: AI tool selection — only Claude Code available
- **WHEN** user is prompted to select an AI tool
- **THEN** only "Claude Code" is listed as an option and is pre-selected

### Requirement: Config file written on init
The system SHALL write `.fabrick/config.yaml` with `project`, `repo`, and `backendUrl` fields.

#### Scenario: Config written with correct values
- **WHEN** `fabrick init` completes successfully
- **THEN** `.fabrick/config.yaml` exists with `project: <name>`, `repo: <name>`, and `backendUrl: http://localhost:3000`

#### Scenario: Existing config prompts overwrite confirmation
- **WHEN** `.fabrick/config.yaml` already exists
- **THEN** CLI asks user to confirm overwrite before proceeding

### Requirement: Skills installed into local project
The system SHALL copy embedded skill files into `.claude/skills/` in the current working directory.

#### Scenario: Skills copied on init
- **WHEN** `fabrick init` completes
- **THEN** `.claude/skills/fabrick-analyze/SKILL.md` exists in the current project

#### Scenario: Existing skill file prompts overwrite confirmation
- **WHEN** `.claude/skills/fabrick-analyze/SKILL.md` already exists
- **THEN** CLI asks user to confirm overwrite before copying

### Requirement: Clear next-step guidance after init
The system SHALL print actionable next steps after successful initialization.

#### Scenario: Success message shown
- **WHEN** `fabrick init` completes without errors
- **THEN** CLI prints a message instructing the user to run `/fabrick-analyze` in Claude Code, then `fabrick push`
