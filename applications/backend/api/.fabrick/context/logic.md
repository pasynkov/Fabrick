# Key Business Logic

## Startup: Bucket Initialization

`MinioService.onModuleInit()` (`src/minio/minio.service.ts`) runs once at application startup via NestJS lifecycle hooks. It calls `client.bucketExists('fabrick')` and, if the bucket does not exist, calls `client.makeBucket('fabrick')`. This ensures the storage bucket is ready before any requests are served. If MinIO is unreachable, the error propagates and NestJS fails to start.

## ZIP Upload Flow: `POST /context/:repo`

1. `ContextController.uploadContext()` (`src/context/context.controller.ts`) receives the multipart request via `FileInterceptor('file', { storage: memoryStorage() })`. The entire ZIP is buffered into `file.buffer` — no disk writes.
2. If `file` is `undefined` (no `file` field in the multipart body), a `BadRequestException` (HTTP 400) is thrown immediately.
3. `ContextService.uploadZip(repo, file.buffer)` (`src/context/context.service.ts`) calls `unzipper.Open.buffer(buffer)` to parse the ZIP in memory.
4. For each entry where `entry.type === 'File'` (directories skipped), `entry.buffer()` reads the full file content into a Buffer.
5. `MinioService.putObject('fabrick', '{repo}/context/{entry.path}', content)` stores the file. The key preserves the full path within the ZIP, enabling nested directory structures.
6. The controller returns HTTP 201 with no body.

## File Listing Flow: `GET /context/:repo`

1. `ContextController.listContext()` delegates to `ContextService.listFiles(repo)`.
2. `ContextService.listFiles()` calls `MinioService.listObjects('fabrick', '{repo}/context/')`.
3. `MinioService.listObjects()` (`src/minio/minio.service.ts`) calls `client.listObjects(bucket, prefix, true)` (recursive=true) and collects all `obj.name` values from the event stream into a string array.
4. Returns HTTP 200 with a JSON array of full MinIO object keys (e.g., `["my-repo/context/src/index.ts"]`).

## Key Design Choices Visible in Code

- **In-memory only**: `memoryStorage()` in multer config + `unzipper.Open.buffer()` — no temp files written anywhere.
- **Overwrite on re-upload**: `putObject` has no conflict check; identical keys are silently overwritten.
- **No auth**: All endpoints are open. No guards or interceptors beyond multer.
- **Env-driven MinIO config**: `MinioService` constructor reads `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` with hardcoded `minioadmin` fallbacks for local dev.
