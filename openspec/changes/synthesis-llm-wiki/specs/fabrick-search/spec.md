## MODIFIED Requirements

### Requirement: Skill reads index.md first
The skill SHALL always start by calling `get_synthesis_index` MCP tool before calling any other tool. The index page (slug `index`) is stored in `synthesis_pages` and returned by the same API endpoint used for all pages.

#### Scenario: Navigation starts from index
- **WHEN** user asks any question
- **THEN** skill calls `get_synthesis_index` before calling `get_synthesis_file`

### Requirement: Skill reads only relevant files
The skill SHALL call `get_synthesis_file` only for slugs identified as relevant by reading the index — not all pages.

#### Scenario: Targeted page read for entity question
- **WHEN** user asks "what fields does the User entity have?"
- **THEN** skill calls `get_synthesis_file("entities/User")` only

#### Scenario: Flow page read for process question
- **WHEN** user asks "how does checkout work end to end?"
- **THEN** skill calls `get_synthesis_file("flows/checkout")`
