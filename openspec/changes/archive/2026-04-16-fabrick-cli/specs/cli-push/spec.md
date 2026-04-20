## ADDED Requirements

### Requirement: Read config before upload
The system SHALL read `.fabrick/config.yaml` to obtain `repo` and `backendUrl` before proceeding.

#### Scenario: Config present and valid
- **WHEN** `.fabrick/config.yaml` exists with `repo` and `backendUrl` fields
- **THEN** CLI uses those values for the upload

#### Scenario: Config missing
- **WHEN** `.fabrick/config.yaml` does not exist
- **THEN** CLI exits with an error: "`.fabrick/config.yaml` not found. Run `fabrick init` first."

### Requirement: Context folder must exist before upload
The system SHALL verify `.fabrick/context/` exists and is non-empty before zipping.

#### Scenario: Context folder missing
- **WHEN** `.fabrick/context/` does not exist
- **THEN** CLI exits with an error instructing user to run `/fabrick-analyze` in Claude Code first

#### Scenario: Context folder empty
- **WHEN** `.fabrick/context/` exists but contains no files
- **THEN** CLI exits with the same error as missing context

### Requirement: Context folder zipped and uploaded
The system SHALL zip `.fabrick/context/` and POST it to the backend as multipart/form-data with field name `file`.

#### Scenario: Successful upload
- **WHEN** `.fabrick/context/` is non-empty and backend is reachable
- **THEN** CLI POSTs ZIP to `{backendUrl}/context/{repo}`, receives HTTP 201, and reports success

#### Scenario: Backend returns 4xx or 5xx
- **WHEN** backend responds with an error status
- **THEN** CLI reports the HTTP status and response body

#### Scenario: Backend unreachable
- **WHEN** connection to `backendUrl` fails
- **THEN** CLI reports a connection error with the URL that was tried

### Requirement: Clear success and failure output
The system SHALL report the outcome of push clearly.

#### Scenario: Success output
- **WHEN** upload succeeds
- **THEN** CLI prints repo name, backend URL, and confirmation message

#### Scenario: Failure output
- **WHEN** upload fails for any reason
- **THEN** CLI prints the specific error and does not exit silently
