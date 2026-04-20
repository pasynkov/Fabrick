## ADDED Requirements

### Requirement: Upload ZIP archive for a repository
The system SHALL expose a `POST /context/:repo` endpoint that accepts a single ZIP file uploaded as `multipart/form-data` under the field name `file`. Upon receipt, the system SHALL extract all entries from the ZIP in-memory (no temporary files written to disk) and store each extracted file as an object in MinIO under the key `{repo}/context/{filepath}`, where `{filepath}` is the entry's path within the ZIP. On success the system SHALL return HTTP 201 with no body.

#### Scenario: Successful ZIP upload
- **WHEN** a client sends `POST /context/my-repo` with a valid ZIP file as `multipart/form-data` field `file`
- **THEN** the system extracts all ZIP entries in-memory, writes each to MinIO under `my-repo/context/<entry-path>`, and responds with HTTP 201

#### Scenario: ZIP contains nested directory entries
- **WHEN** the uploaded ZIP contains files in subdirectories (e.g., `src/index.ts`, `src/util/helper.ts`)
- **THEN** each file is stored in MinIO preserving its path: `{repo}/context/src/index.ts`, `{repo}/context/src/util/helper.ts`

#### Scenario: Re-upload overwrites existing objects
- **WHEN** a client uploads a ZIP for a repo that already has objects in MinIO
- **THEN** existing objects with matching keys are silently overwritten and the system responds with HTTP 201

#### Scenario: No file field provided
- **WHEN** a client sends `POST /context/:repo` without a `file` field in the multipart body
- **THEN** the system SHALL return HTTP 400
