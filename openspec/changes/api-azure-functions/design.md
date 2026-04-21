## Context

The API is a NestJS app that starts an Express HTTP server on port 3000. Azure Functions requires a different entry point — the runtime invokes a handler function per HTTP request, not a persistent server.

After `synthesis-extract`, the API has no background tasks and is fully stateless, making it safe for Functions deployment.

## Goals / Non-Goals

**Goals:**
- API deployable to Azure Functions Consumption plan
- Local docker-compose continues to work unchanged (Express server)
- No changes to controllers, services, guards, or business logic
- `func start` works locally with Functions Core Tools

**Non-Goals:**
- Durable Functions or queue-triggered Functions (synthesis is a separate service)
- Cold start optimization (Consumption plan accepted)

## Decisions

### 1. Adapter choice

`@nestjs/azure-func-http` wraps a NestJS app as an Azure HTTP Function. It creates a single catch-all HTTP trigger that routes all requests through the NestJS router.

Alternative considered: `@azure/functions` v4 with manual Express bridge. Rejected — more boilerplate, same outcome.

### 2. Entry points

```
main.ts              → Express server (used by docker-compose, local dev)
main.azure.ts        → Azure Functions entry point
host.json            → Functions runtime config (routePrefix: "")
local.settings.json  → Functions local env (not committed, .gitignore)
```

`main.azure.ts`:
```typescript
import { AzureHttpAdapter } from '@nestjs/azure-func-http';
import { AppModule } from './app.module';

export default AzureHttpAdapter(AppModule);
```

### 3. Build output

Functions expects the handler at a known path. `nest-cli.json` updated to output `main.azure.js` at the root of `dist/` alongside `main.js`.

### 4. Environment variables

Local Functions (`local.settings.json`):
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "DB_HOST": "localhost",
    "MINIO_ENDPOINT": "localhost",
    ...
  }
}
```

Production: env vars injected via Azure Functions Application Settings (set in Bicep).

### 5. TypeORM connection pool

Functions instances are short-lived but can be reused. TypeORM connection is established on cold start and reused across warm invocations. No changes needed — this is standard behavior.

## Risks / Trade-offs

- **Cold start**: Consumption plan cold starts take 1-3s for Node.js. Acceptable for an API called by CLI and console (not real-time).
- **Connection limits**: many Functions instances → many PG connections. Mitigation: use `max: 2` pool size per instance; consider Azure Database connection pooler (PgBouncer) if needed.
- **File system**: Functions has read-only file system except `/tmp`. The API reads `synthesis-prompt.txt` from `assets/` — this is bundled in the deployment package, so it works. No runtime file writes in API after synthesis is extracted.
