## ADDED Requirements

### Requirement: Backend serves Claude skills zip
The backend SHALL expose `GET /skills/claude` returning a zip file containing the default Fabrick skills for Claude Code. The endpoint SHALL require CLI token authentication.

#### Scenario: Authenticated download
- **WHEN** CLI sends `GET /skills/claude` with valid CLI token
- **THEN** response is a zip file with `Content-Type: application/zip` containing `fabrick-analyze/`, `fabrick-push/`, `fabrick-search/` directories

#### Scenario: Unauthenticated request rejected
- **WHEN** request has no Authorization header
- **THEN** response is 401 Unauthorized

### Requirement: init prompts for AI tool
During `fabrick init`, the CLI SHALL ask the user which AI tool they use before downloading skills. The selected tool SHALL be saved to `.fabrick/config.yaml` as `ai_tool`.

#### Scenario: User selects Claude
- **WHEN** user runs `fabrick init` and selects "Claude" at the AI tool prompt
- **THEN** `ai_tool: claude` is written to `.fabrick/config.yaml`

### Requirement: init downloads and installs skills
After AI tool selection, `fabrick init` SHALL download the skills zip and extract it into `.claude/skills/` in the current directory.

#### Scenario: Skills installed on init
- **WHEN** init completes successfully with Claude selected
- **THEN** `.claude/skills/fabrick-analyze/`, `.claude/skills/fabrick-push/`, `.claude/skills/fabrick-search/` exist in the project directory

#### Scenario: Only fabrick-* skills overwritten
- **WHEN** `.claude/skills/` already contains a non-fabrick skill (e.g., `my-custom-skill/`)
- **AND** init runs
- **THEN** `my-custom-skill/` is untouched after extraction

#### Scenario: Existing fabrick skills overwritten
- **WHEN** `.claude/skills/fabrick-analyze/` already exists with old content
- **AND** init runs
- **THEN** `fabrick-analyze/` is replaced with content from the downloaded zip
