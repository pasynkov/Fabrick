## Why

The API needs to run as Azure Functions (Consumption plan) in production to minimize hosting cost and leverage managed scaling. The current NestJS setup runs as a long-lived HTTP server — incompatible with the Functions execution model.

After `synthesis-extract` removes all background tasks from the API, the remaining handlers are stateless synchronous HTTP endpoints, making Functions a natural fit.

## What Changes

- Add `@azure/functions` and `@nestjs/azure-func-http` (or equivalent adapter)
- Create `applications/backend/api/src/main.azure.ts` as the Functions entry point
- Add `host.json` and `local.settings.json` for local Functions runtime
- `main.ts` (Express) remains for local Docker usage — both entry points supported
- No changes to controllers, services, or business logic

## Local Dev

Two modes:
- `docker-compose`: continues to work with `npm run start` (Express server, port 3000)
- Azure Functions locally: `func start` using `local.settings.json`

## Impact

- New files: `main.azure.ts`, `host.json`, `local.settings.json`
- Package additions: `@azure/functions`, NestJS Azure adapter
- No changes to existing application logic
- Prerequisite: `synthesis-extract` (API must be stateless before deploying to Functions)
