## Why

All services are ready for cloud deployment but there is no infrastructure definition. Manual portal deployment is not repeatable and blocks CI/CD. Infrastructure as code (Terraform) gives reproducible environments and documents the target architecture explicitly.

## What Changes

New directory: `infrastructure/` with Terraform files for all Azure resources.

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| PostgreSQL | Azure Database for PostgreSQL Flexible Server | Burstable B1ms (~$12/mo), cheapest available tier |
| Storage | Azure Storage Account | LRS; blobs for synthesis files and context uploads |
| Service Bus | Azure Service Bus Namespace + Queue | `synthesis-jobs` queue, Standard tier (~$10/mo base) |
| API | Azure Functions (Consumption plan) | HTTP-triggered, connected to PG + Storage + Service Bus |
| ACR | Azure Container Registry | Basic tier; synthesis image |
| Container Apps Env | Azure Container Apps Environment | Synthesis only |
| Synthesis | Container App | KEDA, minReplicas: 0, Service Bus trigger |
| Key Vault | Azure Key Vault | Stores JWT_SECRET, ANTHROPIC_API_KEY, DB password, SB connection |
| Console | Azure Static Web App | Free tier; Vite SPA |
| Landing | Azure Static Web App | Free tier; Vite SPA |

**MCP is an npm package (`@fabrick/mcp`), not a deployed service. No Azure resource needed.**

### CI/CD

- GitHub Actions: build → push synthesis image to ACR → update Container App
- Separate workflow for `api` (Functions publish)
- Static Web Apps deploy via built-in GitHub Actions integration
- `terraform validate` on every PR

## Local Dev Preserved

`docker-compose.yml` remains canonical local dev (azurite, nats, postgres). Infrastructure is cloud-only.

## Impact

- New: `infrastructure/` with Terraform files
- New: `.github/workflows/deploy-api.yml`, `deploy-containers.yml`
- No changes to application code (storage + queue abstractions already implemented)
