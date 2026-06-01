## MODIFIED Requirements

### Requirement: Backend serves Claude skills zip
The backend SHALL expose `GET /skills/claude` returning a zip file containing the default Fabrick skills for Claude Code. The endpoint SHALL require CLI token authentication. The zip SHALL be assembled per request from the `prompt_revisions` table: the server SHALL select every row where `agent = 'claude'` and `name LIKE 'fabrick-%'`, pick the highest `revision` per `name`, and for each selected row write one entry per `(path, body)` pair in `content.files` under a directory named after the prompt's `name`. For each entry whose filename is `SKILL.md`, the server SHALL inject a `version: 1.<revision>` line into the YAML frontmatter on the fly so the served skill carries the active revision number; other files SHALL be served unchanged.

#### Scenario: Authenticated download
- **WHEN** CLI sends `GET /skills/claude` with valid CLI token
- **AND** the latest revision of `fabrick-analyze/claude` is 5 with `content.files` containing `SKILL.md` and `patterns.md`
- **AND** the latest revision of `fabrick-push/claude` is 2 with `content.files` containing `SKILL.md`
- **THEN** the response is a zip file with `Content-Type: application/zip`
- **AND** the zip contains entries `fabrick-analyze/SKILL.md`, `fabrick-analyze/patterns.md`, and `fabrick-push/SKILL.md`
- **AND** `fabrick-analyze/SKILL.md` contains a frontmatter line `version: 1.5`
- **AND** `fabrick-push/SKILL.md` contains a frontmatter line `version: 1.2`
- **AND** `fabrick-analyze/patterns.md` is byte-identical to the value stored in `content.files['patterns.md']`

#### Scenario: Unauthenticated request rejected
- **WHEN** request has no Authorization header
- **THEN** response is 401 Unauthorized

#### Scenario: Newer admin revision is reflected on next request
- **WHEN** an admin POSTs a new revision of `fabrick-analyze/claude` (now revision 6)
- **AND** the CLI subsequently sends `GET /skills/claude`
- **THEN** the served `fabrick-analyze/SKILL.md` carries `version: 1.6`
- **AND** its body reflects the new `content.files['SKILL.md']`

#### Scenario: Frontmatter without an existing version line
- **WHEN** the stored `SKILL.md` body begins with `---\n` and contains a frontmatter block with no `version:` key
- **THEN** the served file inserts a new `version: 1.<revision>` line inside the frontmatter block

#### Scenario: Frontmatter with an existing version line
- **WHEN** the stored `SKILL.md` body already contains a `version:` line inside its frontmatter block
- **THEN** the served file replaces that line with `version: 1.<revision>` rather than adding a duplicate

#### Scenario: No matching prompts yields an empty zip
- **WHEN** the table contains no rows matching `agent='claude' AND name LIKE 'fabrick-%'`
- **THEN** the response is still `200 OK` with `Content-Type: application/zip`
- **AND** the zip contains no entries

#### Scenario: Static skills zip asset is no longer served
- **WHEN** the api boots
- **THEN** it does not read `applications/backend/api/src/assets/claude-skills.zip` for this endpoint
- **AND** the build pipeline does not need to package that asset
