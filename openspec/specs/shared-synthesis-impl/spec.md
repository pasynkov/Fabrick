## ADDED Requirements

### Requirement: SynthesisImpl builds context from pre-loaded wiki data
`SynthesisImpl.buildContext()` SHALL accept pre-loaded repo wiki data (array of `{ slug, files[] }`), existing pages, and changedRepos list. It SHALL return a context string formatted for Claude. It SHALL NOT read from any storage service directly.

#### Scenario: Full synthesis context
- **WHEN** buildContext receives 2 repos with wiki files, no existing pages, changedRepos = all
- **THEN** returns context string with `=== REPO: slug ===` blocks containing all wiki file contents

#### Scenario: Incremental synthesis context
- **WHEN** buildContext receives 2 repos, existing pages, changedRepos = [repo-b]
- **THEN** returns context with full files for repo-b, index-only for repo-a, and existing pages block

### Requirement: SynthesisImpl calls Claude for synthesis
`SynthesisImpl.synthesize()` SHALL call Claude with the system prompt and user context, returning raw response text.

#### Scenario: Successful Claude call
- **WHEN** synthesize is called with context string and API key
- **THEN** it calls Claude claude-sonnet-4-6 with SYNTHESIS_SYSTEM_PROMPT and returns response text

#### Scenario: Truncated response throws error
- **WHEN** Claude response has stop_reason = max_tokens
- **THEN** synthesize throws an error

### Requirement: SynthesisImpl parses Claude response into pages and deletes
`SynthesisImpl.parseResponse()` SHALL parse raw Claude output into `{ pages: WikiPageData[], deleteSlugs: string[] }`. It SHALL handle PAGE and DELETE markers, YAML frontmatter with slug/category/title/sources/related fields.

#### Scenario: Parse pages with frontmatter
- **WHEN** raw text contains `=== PAGE: entities/user ===` followed by YAML frontmatter and content
- **THEN** parseResponse returns a WikiPageData with slug, category, title, content, sources, related

#### Scenario: Parse delete markers
- **WHEN** raw text contains `=== DELETE: old-page ===`
- **THEN** parseResponse includes "old-page" in deleteSlugs

### Requirement: Synthesis system prompt is a TS constant
The system prompt SHALL be exported as `SYNTHESIS_SYSTEM_PROMPT` from `shared/synthesis/synthesis-prompt.ts`. No runtime file reads.

#### Scenario: Prompt is importable
- **WHEN** SynthesisImpl or any consumer imports SYNTHESIS_SYSTEM_PROMPT
- **THEN** it receives the full prompt string without filesystem access
