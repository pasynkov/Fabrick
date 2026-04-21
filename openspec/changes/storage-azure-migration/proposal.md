## Why

MinIO was used as a local-dev-friendly S3-compatible store, but Azure Blob Storage is the production target and has no S3-compatible API. Aligning local dev (Azurite) and prod (Azure Blob Storage) on the same SDK eliminates the protocol mismatch and removes MinIO from the stack entirely.

## What Changes

- Replace `minio` npm package with `@azure/storage-blob` in `api` and `synthesis` services
- Rename `minio/` source folders to `storage/` in both services; rename `MinioService` → `StorageService`
- Replace MinIO in `docker-compose.yml` with Azurite (Azure Storage emulator)
- Replace `MINIO_*` env vars with `AZURE_STORAGE_CONNECTION_STRING`
- Container auto-creation on first use (replaces `ensureBucket` on startup)

## Capabilities

### New Capabilities

- `azure-blob-storage`: Object storage via `@azure/storage-blob` — same 3-method interface (`putObject`, `getObject`, `listObjects`), container = orgSlug, auto-created on demand

### Modified Capabilities

- `minio-bucket-init`: Bucket auto-create on startup → container auto-create on first use (lazy, per-container)

## Impact

- `applications/backend/api/src/minio/` → `storage/`
- `applications/backend/synthesis/src/minio/` → `storage/`
- `applications/backend/docker-compose.yml`: MinIO service removed, Azurite added
- `api/package.json`, `synthesis/package.json`: `minio` removed, `@azure/storage-blob` added
- All callers of `MinioService` updated to `StorageService` (same method signatures)
- Env var change: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` → `AZURE_STORAGE_CONNECTION_STRING`
