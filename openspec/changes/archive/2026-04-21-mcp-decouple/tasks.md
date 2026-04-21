## Prerequisites

- [x] `auth-unify` complete (MCP tokens are JWTs)

## 1. Remove DB dependencies from MCP

- [x] 1.1 Delete `src/auth/cli-token.entity.ts` from `applications/backend/mcp/`
- [x] 1.2 Delete `src/auth/token-validator.service.ts` from MCP
- [x] 1.3 Remove `@nestjs/typeorm`, `typeorm`, `pg` from `applications/backend/mcp/package.json`
- [x] 1.4 Remove `TypeOrmModule` from `app.module.ts` in MCP
- [x] 1.5 Remove `AuthModule` from MCP if it only wrapped `TokenValidatorService`

## 2. Remove storage dependencies from MCP

- [x] 2.1 Delete `src/minio/minio.service.ts` from MCP
- [x] 2.2 Remove `minio` package from MCP `package.json`
- [x] 2.3 Remove `MinioModule` from MCP `app.module.ts`

## 3. Local JWT validation in MCP

- [x] 3.1 Install `jsonwebtoken` (or use `@nestjs/jwt`) in MCP
- [x] 3.2 Update `McpController`: strip `fbrk_` prefix, call `jwt.verify(token, JWT_SECRET)`
- [x] 3.3 Extract `org` and `project` from JWT claims (remove `X-Fabrick-Org` / `X-Fabrick-Project` header parsing)
- [x] 3.4 Add `JWT_SECRET` to MCP env vars

## 4. ApiClientService

- [x] 4.1 Create `src/api/api-client.service.ts` in MCP — `fetch`-based HTTP client
- [x] 4.2 Implement `getSynthesisFile(org, project, path, token): Promise<string>` calling `GET {API_URL}/orgs/{org}/projects/{project}/synthesis/file?path={path}`
- [x] 4.3 Implement `getSynthesisIndex(org, project, token): Promise<string>` calling the index file endpoint
- [x] 4.4 Update `McpService.readSynthesisFile()` to call `ApiClientService` instead of `MinioService`
- [x] 4.5 Add `API_URL` env var to MCP

## 5. docker-compose

- [x] 5.1 Remove `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `MINIO_*` from MCP service env
- [x] 5.2 Add `JWT_SECRET` and `API_URL: http://api:3000` to MCP service env
- [x] 5.3 Change MCP `depends_on` to only `api` (remove `postgres`, `minio`)
