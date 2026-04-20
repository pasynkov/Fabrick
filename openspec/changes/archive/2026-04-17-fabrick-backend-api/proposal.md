## Why

The Fabrick PoC needs a backend API service that can ingest repository context (as a ZIP archive) and store it in object storage for downstream processing. Without this endpoint, there is no mechanism to upload and persist codebase snapshots into the system.

## What Changes

- Add a NestJS backend API application under `applications/backend/api/`
- Introduce a `POST /context/:repo` endpoint that accepts a ZIP file via multipart/form-data, extracts files in-memory, and stores each to MinIO under the `{repo}/context/` prefix
- Introduce a `GET /context/:repo` endpoint that lists all files stored for a given repo (for debugging)
- Auto-create the `fabrick` MinIO bucket on application startup if it does not exist
- Integrate with the existing `fabrick-infra` Docker skeleton (NestJS already running)

## Capabilities

### New Capabilities

- `context-upload`: Accept a ZIP archive for a given repo via multipart/form-data, stream-extract in-memory, and store each file to MinIO under `{repo}/context/`
- `context-list`: List all stored files for a given repo from MinIO (debug endpoint)
- `minio-bucket-init`: Ensure the `fabrick` MinIO bucket exists on application startup

### Modified Capabilities

## Impact

- New application at `applications/backend/api/` (NestJS)
- New npm dependencies: `@nestjs/platform-express`, `multer`, `unzipper` (or `jszip`), `minio` (or `aws-sdk`)
- MinIO service must be reachable from the backend container (already provided by `fabrick-infra`)
- No auth, no versioning, no persistent disk — PoC scope only
