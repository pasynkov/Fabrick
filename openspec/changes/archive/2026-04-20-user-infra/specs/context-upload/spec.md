## MODIFIED Requirements

### Requirement: Upload ZIP archive for a repository
The system SHALL expose a `POST /repos/:repoId/context` endpoint (replacing the old `/context/:repo`) protected by CLI token auth guard. The guard SHALL resolve the repo from `repoId`, verify the authenticated user is a member of the repo's project's organization, and reject with HTTP 403 if not. Upon receipt of a valid ZIP as `multipart/form-data` field `file`, the system SHALL extract all entries in-memory and store each file in MinIO under the key `<org-slug>/<project-slug>/<repo-slug>/context/<filepath>`. On success the system SHALL return HTTP 201 with no body.

#### Scenario: Successful ZIP upload
- **WHEN** an authenticated CLI client sends `POST /repos/:repoId/context` with a valid ZIP file as `multipart/form-data` field `file`
- **THEN** the system extracts all ZIP entries in-memory, writes each to MinIO under `<org-slug>/<project-slug>/<repo-slug>/context/<entry-path>`, and responds with HTTP 201

#### Scenario: ZIP contains nested directory entries
- **WHEN** the uploaded ZIP contains files in subdirectories (e.g., `src/index.ts`)
- **THEN** each file is stored in MinIO preserving its path: `<org-slug>/<project-slug>/<repo-slug>/context/src/index.ts`

#### Scenario: Re-upload overwrites existing objects
- **WHEN** a client uploads a ZIP for a repo that already has objects in MinIO
- **THEN** existing objects with matching keys are silently overwritten and the system responds with HTTP 201

#### Scenario: No file field provided
- **WHEN** a client sends `POST /repos/:repoId/context` without a `file` field in the multipart body
- **THEN** the system SHALL return HTTP 400

#### Scenario: User not member of repo's org
- **WHEN** a CLI token belongs to a user who is not a member of the repo's organization
- **THEN** the system returns HTTP 403

#### Scenario: Repo not found
- **WHEN** `:repoId` does not match any repository
- **THEN** the system returns HTTP 404

## REMOVED Requirements

### Requirement: Upload ZIP archive for a repository (old path)
**Reason**: Endpoint moved to `/repos/:repoId/context` with auth. The old `/context/:repo` path is removed.
**Migration**: Update CLI to use new endpoint with `repo_id` from `.fabrick/config.yaml` and CLI token auth header.
