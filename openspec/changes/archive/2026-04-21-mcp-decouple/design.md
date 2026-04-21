## Context

MCP server (`applications/backend/mcp/`) currently imports TypeORM, connects to PostgreSQL for token validation, and connects to MinIO for reading synthesis files. It carries the same infrastructure footprint as the full API.

## Goals / Non-Goals

**Goals:**
- MCP has zero direct DB or storage connections
- Token validation is local JWT verification (no network call)
- Synthesis files fetched via API HTTP call
- MCP env: `JWT_SECRET` + `API_URL` only

**Non-Goals:**
- Changes to MCP protocol or tool definitions
- Caching synthesis files locally in MCP

## Decisions

### 1. Token validation

After `auth-unify`, MCP tokens are JWTs. MCP strips the `fbrk_` prefix and calls `jwt.verify(token, JWT_SECRET)`. No DB. The verified payload contains `org` and `project` — no headers needed.

```typescript
// McpController (simplified)
const raw = token.startsWith('fbrk_') ? token.slice(5) : token;
const payload = jwt.verify(raw, process.env.JWT_SECRET);
const { org, project } = payload;
```

### 2. Synthesis file reads

Current: `MinioService.getObject(orgSlug, key)` — direct storage SDK call.

After: `ApiClientService.getSynthesisFile(org, project, path)`:
```
GET {API_URL}/orgs/{org}/projects/{project}/synthesis/files/{path}
Authorization: Bearer {token}   ← forward the user's MCP token
```

The API already has this endpoint (used by the console). MCP reuses it.

### 3. ApiClientService

Thin HTTP client using `node-fetch` or Node.js built-in `fetch`:
```typescript
@Injectable()
export class ApiClientService {
  async getSynthesisFile(org: string, project: string, path: string, token: string): Promise<string>
  async getSynthesisIndex(org: string, project: string, token: string): Promise<string>
}
```

### 4. Removed dependencies from MCP package.json

- `@nestjs/typeorm`
- `typeorm`
- `pg`
- `minio`

### 5. docker-compose MCP service

```yaml
mcp:
  environment:
    JWT_SECRET: change-me-in-production
    API_URL: http://api:3000
  depends_on:
    - api   # only API, no postgres/minio
```

## Risks / Trade-offs

- **Latency**: each MCP tool call now makes an HTTP request to API (was direct storage read). For synthesis files this adds ~1-5ms on local network. Acceptable.
- **API availability**: MCP depends on API being up. In docker-compose, `depends_on: api` handles this locally. In cloud, both are always-on services.
