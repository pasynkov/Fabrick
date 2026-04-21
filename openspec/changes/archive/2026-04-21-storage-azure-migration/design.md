## Context

Two services use MinIO as object storage: `api` (context upload/list) and `synthesis` (read context, write synthesis output). Both wrap MinIO behind a thin `MinioService` with 3 methods. MinIO speaks S3 protocol; Azure Blob Storage speaks its own protocol — the two are incompatible at the SDK level.

Current env vars: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`.  
Current docker-compose: MinIO container at port 9000.

## Goals / Non-Goals

**Goals:**
- Replace MinIO SDK with `@azure/storage-blob` in both services
- Keep identical external interface: `putObject`, `getObject`, `listObjects`
- Replace MinIO in docker-compose with Azurite for local dev parity
- Single env var: `AZURE_STORAGE_CONNECTION_STRING`

**Non-Goals:**
- Data migration from existing MinIO data
- Signed URL / presigned URL support
- Any new storage capabilities beyond current usage

## Decisions

### 1. `@azure/storage-blob` over S3-compat workaround

Azure Blob Storage has no native S3-compatible API. MinIO-as-gateway to Azure is deprecated in newer MinIO versions. Native SDK is the only viable path.

### 2. Lazy container creation (not startup check)

Current `ensureBucket` in `api/MinioService` runs at startup for a fixed `fabrick` bucket. New approach: create container on first `putObject`/`getObject`/`listObjects` call, per container. 

**Why:** containers are dynamic (per orgSlug), startup check doesn't make sense. `BlobServiceClient.getContainerClient(name).createIfNotExists()` is idempotent and cheap.

### 3. Rename `minio/` → `storage/`, `MinioService` → `StorageService`

Avoids naming confusion. Callers updated via import path change only — method signatures unchanged.

### 4. Azurite in docker-compose

`mcr.microsoft.com/azure-storage/azurite` — official Microsoft emulator. Same `@azure/storage-blob` SDK works against it with a standard dev connection string. Replaces MinIO container entirely.

```
Dev connection string (Azurite default):
DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tiqp;BlobEndpoint=http://azurite:10000/devstoreaccount1;
```

## Risks / Trade-offs

- **Azurite behavior delta vs real Azure** → minimal for basic blob ops (put/get/list); acceptable for dev
- **Container name constraints** — Azure container names must be 3-63 chars, lowercase alphanumeric + hyphens. OrgSlug must conform. → No mitigation needed if slugs are already lowercase (verify)
- **No data migration** — existing MinIO data lost on switch. Acceptable since this is pre-prod.

## Migration Plan

1. Update docker-compose: swap MinIO → Azurite
2. Update `api` service: new package, new `StorageService`, update modules + callers
3. Update `synthesis` service: same
4. Update env var docs / `.env.example` if exists
5. Verify locally: `docker-compose up`, run push + synthesis flow end-to-end
