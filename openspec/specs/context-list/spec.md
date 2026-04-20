## ADDED Requirements

### Requirement: List stored files for a repository
The system SHALL expose a `GET /context/:repo` endpoint that returns a JSON array of object keys currently stored in MinIO under the prefix `{repo}/context/`. This endpoint is intended for debugging purposes. The system SHALL return HTTP 200 with an array of strings representing the full MinIO object keys.

#### Scenario: Repo has stored files
- **WHEN** a client sends `GET /context/my-repo` and MinIO contains objects under `my-repo/context/`
- **THEN** the system responds with HTTP 200 and a JSON array of all matching object keys (e.g., `["my-repo/context/src/index.ts", "my-repo/context/README.md"]`)

#### Scenario: Repo has no stored files
- **WHEN** a client sends `GET /context/my-repo` and no objects exist under `my-repo/context/` in MinIO
- **THEN** the system responds with HTTP 200 and an empty JSON array `[]`
