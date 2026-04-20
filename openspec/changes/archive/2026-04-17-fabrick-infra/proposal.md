## Why

The Fabrick PoC needs a local infrastructure foundation before any other component can be built or tested. MinIO provides S3-compatible object storage for context data, and a NestJS skeleton gives the backend a runnable home that subsequent changes will build on.

## What Changes

- Add `applications/backend/` directory
- `docker-compose.yml` with MinIO and NestJS services
- NestJS app skeleton (Dockerfile + health check only)
- MinIO bucket `fabrick` auto-created on startup

## Capabilities

### New Capabilities

- `fabrick-infra`: Local infrastructure — MinIO + NestJS running via docker-compose

### Modified Capabilities

<!-- none -->

## Impact

- New directory: `applications/backend/`
- No changes to existing files
- Requires Docker to be installed locally
