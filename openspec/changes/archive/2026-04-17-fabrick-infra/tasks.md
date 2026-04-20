## 1. Directory Structure

- [x] 1.1 Create `applications/backend/` directory
- [x] 1.2 Create `applications/backend/api/src/` skeleton (empty NestJS structure)

## 2. docker-compose

- [x] 2.1 Write `applications/backend/docker-compose.yml` with MinIO service (ports 9000/9001, credentials, named volume)
- [x] 2.2 Add NestJS service to docker-compose (port 3000, depends_on MinIO, build from `./api`)

## 3. NestJS Skeleton

- [x] 3.1 Write `applications/backend/api/Dockerfile` (node:20-alpine, build + start)
- [x] 3.2 Write `applications/backend/api/package.json` with minimal NestJS dependencies
- [x] 3.3 Write `applications/backend/api/src/main.ts` (bootstrap on port 3000)
- [x] 3.4 Write `applications/backend/api/src/app.module.ts` (empty AppModule)
- [x] 3.5 Add `GET /health` endpoint returning 200 OK

## 4. MinIO Bucket Init

- [x] 4.1 Add MinioService with `OnModuleInit` that creates `fabrick` bucket if not exists
- [x] 4.2 Wire MinioService into AppModule

## 5. Verification

- [x] 5.1 `docker-compose up` starts without errors
- [x] 5.2 `GET http://localhost:3000/health` returns 200
- [x] 5.3 MinIO console accessible at http://localhost:9001
- [x] 5.4 `fabrick` bucket visible in MinIO console after startup
