## Why

The MCP server currently depends directly on PostgreSQL (for token validation) and MinIO (for reading synthesis files). This means it needs DB credentials and storage credentials at runtime — the same access level as the full API. This blocks independent deployment of MCP as a lightweight container and prevents running MCP in environments where direct DB/storage access is not available.

MCP should only need the API URL and the ability to verify a JWT signature. It should be stateless and infrastructure-free.

## What Changes

- MCP removes TypeORM, CliToken entity, and MinioService entirely
- Token validation: `jwt.verify(token, JWT_SECRET)` locally — no DB call (depends on `auth-unify`)
- Synthesis files: HTTP call to `GET /api/orgs/:org/projects/:project/synthesis/files/:path`
- Org/project come from JWT claims (not X-Fabrick-* headers)
- MCP env vars reduced to: `JWT_SECRET`, `API_URL`
- `docker-compose.yml`: MCP no longer depends on `postgres` or `minio` services

## Impact

- Removes: `@nestjs/typeorm`, `pg` driver, `minio` package from `applications/backend/mcp/`
- Removes: `cli-token.entity.ts`, `token-validator.service.ts` from MCP
- Adds: `ApiClientService` in MCP (thin HTTP client to API)
- Prerequisite: `auth-unify` must be complete (MCP token is JWT)
