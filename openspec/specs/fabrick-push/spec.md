## ADDED Requirements

### Requirement: Skill reads config
The skill SHALL read `.fabrick/config.yaml` to obtain the repo name and backend URL before uploading.

#### Scenario: Config is present
- **WHEN** `.fabrick/config.yaml` exists with `repo` and `backendUrl` fields
- **THEN** the skill uses those values for the upload

#### Scenario: Config is missing
- **WHEN** `.fabrick/config.yaml` does not exist
- **THEN** the skill reports an error and stops

### Requirement: Context folder is zipped and uploaded
The skill SHALL zip `.fabrick/context/` and POST it to the backend as multipart/form-data.

#### Scenario: Successful upload
- **WHEN** `.fabrick/context/` exists and backend is reachable
- **THEN** the ZIP is posted to `POST {backendUrl}/context/{repo}` and a success message is shown

#### Scenario: Context folder missing
- **WHEN** `.fabrick/context/` does not exist
- **THEN** the skill reports that analyze must be run first and stops

#### Scenario: Backend unreachable
- **WHEN** the backend URL is not reachable
- **THEN** the skill reports a connection error clearly

### Requirement: User receives clear feedback
The skill SHALL report the outcome of the upload clearly.

#### Scenario: Upload succeeds
- **WHEN** backend returns 2xx
- **THEN** skill prints success message including repo name and backend URL

#### Scenario: Upload fails
- **WHEN** backend returns non-2xx or connection fails
- **THEN** skill prints failure message with HTTP status or error details
