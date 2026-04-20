## 1. Project Scaffolding

- [x] 1.1 Create the directory `applications/backend/api/` with a NestJS project structure (`src/`, `package.json`, `tsconfig.json`, `nest-cli.json`)
- [x] 1.2 Add dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `minio`, `unzipper`
- [x] 1.3 Add dev dependencies: `@nestjs/cli`, `@types/multer`, `@types/unzipper`, `typescript`
- [x] 1.4 Create `src/main.ts` bootstrapping the NestJS app on port 3000

## 2. MinIO Service

- [x] 2.1 Create `src/minio/minio.service.ts` with a `MinioService` that holds a configured `minio.Client` instance (endpoint, port, credentials from env vars)
- [x] 2.2 Implement `onModuleInit` in `MinioService`: check if the `fabrick` bucket exists; create it if not
- [x] 2.3 Implement `putObject(bucket, key, buffer)` method on `MinioService`
- [x] 2.4 Implement `listObjects(bucket, prefix)` method on `MinioService` that returns an array of object key strings
- [x] 2.5 Create `src/minio/minio.module.ts` exporting `MinioService`

## 3. Context Module

- [x] 3.1 Create `src/context/context.service.ts` with a `ContextService` that injects `MinioService`
- [x] 3.2 Implement `uploadZip(repo: string, buffer: Buffer): Promise<void>` in `ContextService`: use `unzipper` to stream-parse the buffer, read each entry into a Buffer, and call `MinioService.putObject` with key `{repo}/context/{entryPath}`
- [x] 3.3 Implement `listFiles(repo: string): Promise<string[]>` in `ContextService`: delegate to `MinioService.listObjects('fabrick', '{repo}/context/')` and return the key array
- [x] 3.4 Create `src/context/context.controller.ts` with `ContextController`
- [x] 3.5 Add `POST /context/:repo` handler using `@UseInterceptors(FileInterceptor('file'))` with `memoryStorage()`; call `ContextService.uploadZip`; return 201
- [x] 3.6 Add `GET /context/:repo` handler; call `ContextService.listFiles`; return 200 with JSON array
- [x] 3.7 Create `src/context/context.module.ts` importing `MinioModule` and declaring controller + service

## 4. App Module Wiring

- [x] 4.1 Create `src/app.module.ts` importing `ContextModule`
- [x] 4.2 Verify the app boots locally and MinIO bucket auto-creation runs on startup

## 5. Docker Integration

- [x] 5.1 Add a `Dockerfile` for the backend API under `applications/backend/api/`
- [x] 5.2 Wire the backend API service into the existing `fabrick-infra` Docker Compose file (service name, port mapping, env vars for MinIO connection, `depends_on: minio`)
- [x] 5.3 Confirm `docker compose up` starts the backend and MinIO together, bucket is created, and both endpoints respond correctly
