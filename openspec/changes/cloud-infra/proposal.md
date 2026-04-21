## Why

All services are ready for cloud deployment but there is no infrastructure definition. Manual portal deployment is not repeatable and blocks CI/CD. Infrastructure as code (Bicep) gives reproducible environments, enables preview deployments, and documents the target architecture explicitly.

## What Changes

New directory: `infrastructure/` with Bicep modules for all Azure resources.

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| PostgreSQL | Azure Database for PostgreSQL Flexible Server | Burstable B1ms, prod-grade backups |
| Storage | Azure Storage Account | Replaces MinIO; blobs for synthesis files and context uploads |
| Service Bus | Azure Service Bus Namespace + Queue | `synthesis-jobs` queue, Standard tier |
| API | Azure Functions (Consumption plan) | HTTP-triggered, connected to PG + Storage |
| Container Apps Env | Azure Container Apps Environment | Shared env for MCP and synthesis |
| MCP | Container App | Always-on, min 1 replica, JWT_SECRET + API_URL only |
| Synthesis | Container App | KEDA ScaledObject, minReplicas: 0, Service Bus trigger |
| Key Vault | Azure Key Vault | Stores JWT_SECRET, ANTHROPIC_API_KEY, DB password |

### CI/CD

- GitHub Actions workflow: build → push images to ACR → deploy Bicep
- Separate workflows for `api` (Functions deploy) and containers (ACR push + Container Apps update)

## Local Dev Preserved

`docker-compose.yml` remains the canonical local dev setup. Infrastructure code is cloud-only; no changes to local workflow.

## Impact

- New: `infrastructure/` directory with Bicep modules
- New: `.github/workflows/deploy-api.yml`, `deploy-containers.yml`
- No changes to application code
- Prerequisite: all four preceding changes complete
