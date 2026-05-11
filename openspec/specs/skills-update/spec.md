## MODIFIED Requirements

### Requirement: fabrick-analyze skill orchestrates CLI scan + LLM wiki generation

The `fabrick-analyze` skill SHALL be rewritten to: (1) call `npx @fabrick/cli scan` to get hash diff, (2) guide the LLM to read source files and write wiki pages directly, (3) call `npx @fabrick/cli rebuild-source-map` to rebuild metadata. The skill includes wiki page format spec, taxonomy guidelines, and index.md format.

#### Scenario: User triggers fabrick-analyze (first run)
- **WHEN** user invokes fabrick-analyze skill with no existing wiki
- **THEN** skill runs `fabrick scan` (returns mode=full)
- **AND** LLM reads all source files
- **AND** LLM writes wiki pages to `.fabrick/wiki/`
- **AND** skill runs `fabrick rebuild-source-map`

#### Scenario: User triggers fabrick-analyze (incremental)
- **WHEN** user invokes fabrick-analyze with existing wiki and changed files
- **THEN** skill runs `fabrick scan` (returns mode=incremental with changed files + affected pages)
- **AND** LLM reads only changed source files + affected wiki pages
- **AND** LLM updates/creates/deletes wiki pages as needed
- **AND** skill runs `fabrick rebuild-source-map`

#### Scenario: No changes detected
- **WHEN** user invokes fabrick-analyze and no files changed
- **THEN** skill runs `fabrick scan` (returns empty diff)
- **AND** skill reports "wiki is up to date" without any LLM file operations

### Requirement: fabrick-push skill uploads wiki instead of context

The `fabrick-push` skill SHALL reference `.fabrick/wiki/` instead of `.fabrick/context/` in its description and instructions.

#### Scenario: Push after analyze
- **WHEN** user invokes fabrick-push
- **THEN** skill runs `npx @fabrick/cli push`
- **AND** CLI uploads `.fabrick/wiki/` content

## REMOVED Requirements

### Requirement: fabrick-search skill removed

The `fabrick-search` skill SHALL be removed from the skills zip. MCP tool `fabrick_search` is self-discoverable by agents — no skill wrapper needed.
