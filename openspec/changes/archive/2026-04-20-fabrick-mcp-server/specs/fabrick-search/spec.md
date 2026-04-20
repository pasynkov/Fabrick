## MODIFIED Requirements

### Requirement: Skill reads index.md first
The skill SHALL always start by calling `get_synthesis_index` MCP tool before calling any other tool.

#### Scenario: Navigation starts from index
- **WHEN** user asks any question
- **THEN** skill calls `get_synthesis_index` before calling `get_synthesis_file`

### Requirement: Skill reads only relevant files
The skill SHALL call `get_synthesis_file` only for files identified as relevant by the index — not all files.

#### Scenario: Targeted file read for app question
- **WHEN** user asks "which app handles payments?"
- **THEN** skill calls `get_synthesis_file` for the relevant app file only — not all app files

#### Scenario: Cross-cutting file read for env question
- **WHEN** user asks about a specific env variable
- **THEN** skill calls `get_synthesis_file("cross-cutting/envs.md")`

### Requirement: Answer is accurate and concise
The skill SHALL answer the question accurately based on what it read.

#### Scenario: DoD question answered correctly
- **WHEN** user asks "which app handles X, what are its envs and what do they do?"
- **THEN** skill provides the correct app name, lists its env vars, and explains each one

## REMOVED Requirements

### Requirement: Skill does not load all architecture files
**Reason**: Replaced by MCP tool-based navigation — Claude calls `get_synthesis_file` per file explicitly; reading all files at once is architecturally impossible via MCP tools.
**Migration**: No migration needed; behavior is preserved — Claude still reads only relevant files via targeted tool calls.
