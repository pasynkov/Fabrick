## MODIFIED Requirements

### Requirement: Synthesis worker produces files via delimiter format
The synthesis service SHALL request file output from Claude using a delimiter-based format instead of JSON. The processor SHALL parse the response by splitting on `=== FILE: <name> ===` markers. The processor SHALL throw an error if no files are parsed from the response.

#### Scenario: Claude returns valid delimiter response
- **WHEN** Claude responds with one or more `=== FILE: <name> ===` delimited sections
- **THEN** processor extracts each filename and its content and stores them to object storage

#### Scenario: Claude returns no parseable files
- **WHEN** Claude responds with text that contains no `=== FILE:` markers
- **THEN** processor throws `No files found in Claude response`

#### Scenario: File content contains special characters
- **WHEN** a file section contains newlines, quotes, or backslashes
- **THEN** processor extracts content correctly without parse errors
