## 1. Dependencies

- [x] 1.1 Remove `minio` from `applications/backend/api/package.json`, add `@azure/storage-blob`
- [x] 1.2 Remove `minio` from `applications/backend/synthesis/package.json`, add `@azure/storage-blob`
- [x] 1.3 Run `npm install` in both `api` and `synthesis` directories

## 2. docker-compose

- [x] 2.1 Remove MinIO service from `applications/backend/docker-compose.yml`
- [x] 2.2 Add Azurite service (`mcr.microsoft.com/azure-storage/azurite`, port 10000)
- [x] 2.3 Update `api` and `synthesis` service env vars: remove `MINIO_*`, add `AZURE_STORAGE_CONNECTION_STRING` with Azurite default connection string

## 3. API — StorageService

- [x] 3.1 Create `applications/backend/api/src/storage/storage.service.ts` using `@azure/storage-blob` with methods `putObject`, `getObject`, `listObjects`; lazy container creation on each operation
- [x] 3.2 Create `applications/backend/api/src/storage/storage.module.ts` exporting `StorageService`
- [x] 3.3 Delete `applications/backend/api/src/minio/minio.service.ts` and `minio.module.ts`
- [x] 3.4 Update `applications/backend/api/src/context/context.module.ts` — import `StorageModule` instead of `MinioModule`
- [x] 3.5 Update `applications/backend/api/src/context/context.service.ts` — inject `StorageService` instead of `MinioService`
- [x] 3.6 Update `applications/backend/api/src/synthesis/synthesis.module.ts` — import `StorageModule`
- [x] 3.7 Update `applications/backend/api/src/synthesis/synthesis.service.ts` — inject `StorageService`
- [x] 3.8 Update `applications/backend/api/src/repos/repos.module.ts` if it imports `MinioModule`
- [x] 3.9 Update `applications/backend/api/src/app.module.ts` if it imports `MinioModule`

## 4. Synthesis — StorageService

- [x] 4.1 Create `applications/backend/synthesis/src/storage/storage.service.ts` (same implementation as api)
- [x] 4.2 Create `applications/backend/synthesis/src/storage/storage.module.ts`
- [x] 4.3 Delete `applications/backend/synthesis/src/minio/minio.service.ts` and `minio.module.ts`
- [x] 4.4 Update `applications/backend/synthesis/src/synthesis/synthesis.module.ts` — import `StorageModule`
- [x] 4.5 Update `applications/backend/synthesis/src/synthesis/synthesis.processor.ts` — inject `StorageService`

## 5. Verification

- [x] 5.1 TypeScript compiles without errors in both `api` and `synthesis`
- [x] 5.2 `docker-compose up` starts successfully with Azurite
- [x] 5.3 Context upload flow works end-to-end (push context → stored in Azurite)
- [x] 5.4 Synthesis flow works end-to-end (read context → write synthesis → retrieve)
