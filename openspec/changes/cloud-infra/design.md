## Context

All five services need Azure infrastructure. Resources must be defined as code (Bicep) for repeatability. CI/CD deploys on push to `main`.

## Goals / Non-Goals

**Goals:**
- All resources defined in `infrastructure/` Bicep modules
- Single `main.bicep` deploys everything to a resource group
- GitHub Actions deploys API (Functions) and containers (ACR → Container Apps)
- Secrets in Key Vault, never in code or workflow env
- Local docker-compose unchanged

**Non-Goals:**
- Multi-region deployment
- Blue/green or canary deployments
- Preview environments per PR (can add later)

## Resource Design

### Resource group layout

```
rg-fabrick-prod/
  fabrick-postgres        Azure Database for PostgreSQL Flexible Server (B1ms)
  fabrickstore            Azure Storage Account (LRS, replaces MinIO)
  fabrick-servicebus      Azure Service Bus Namespace (Standard)
    └── synthesis-jobs    Queue
  fabrick-api             Azure Function App (Consumption, Linux, Node 20)
    └── fabrick-api-plan  Consumption Plan
  fabrick-acr             Azure Container Registry (Basic)
  fabrick-cae             Container Apps Environment
    ├── fabrick-mcp       Container App (always-on, min 1 replica)
    └── fabrick-synthesis Container App (KEDA, min 0 replicas)
  fabrick-kv              Azure Key Vault
```

### Storage account (replaces MinIO)

Blobs organized by container = MinIO bucket. Bucket-per-org pattern maps to blob container-per-org.

`MinioService` in both API and synthesis service needs a new implementation:
- Local: MinIO (docker-compose) with existing SDK
- Cloud: Azure Blob Storage with `@azure/storage-blob`

Two implementations behind `StorageService` interface, selected by `STORAGE_DRIVER=minio|azure-blob`. This is a small addition within `synthesis-extract` or handled as part of `cloud-infra`.

### PostgreSQL

Azure Database for PostgreSQL Flexible Server, `Standard_B1ms`. Private access via VNET integration not required for MVP — public endpoint with SSL required + firewall rule for Functions outbound IPs.

### Service Bus

Standard tier (required for KEDA queue triggers). One namespace, one queue `synthesis-jobs`, default lock duration 5 minutes (synthesis jobs expected < 5 min).

### Container Apps — MCP

```bicep
resources: { cpu: '0.25', memory: '0.5Gi' }
scale: { minReplicas: 1, maxReplicas: 3 }
env:
  JWT_SECRET: from Key Vault ref
  API_URL: https://<functions-app>.azurewebsites.net
```

### Container Apps — Synthesis (KEDA)

```bicep
resources: { cpu: '0.5', memory: '1.0Gi' }
scale:
  minReplicas: 0
  maxReplicas: 5
  rules:
    - name: service-bus-trigger
      custom:
        type: azure-servicebus
        metadata:
          queueName: synthesis-jobs
          messageCount: "1"
      auth:
        - secretRef: servicebus-connection
          triggerParameter: connection
```

### CI/CD

Two GitHub Actions workflows:

**`deploy-api.yml`** (triggered on `applications/backend/api/**` changes):
1. `npm ci && npm run build`
2. `func azure functionapp publish fabrick-api`

**`deploy-containers.yml`** (triggered on `applications/backend/mcp/**` or `applications/backend/synthesis/**` changes):
1. Build Docker images
2. Push to ACR (`fabrickacr.azurecr.io`)
3. Update Container App revisions via `az containerapp update`

### Key Vault secrets

| Secret name | Value |
|-------------|-------|
| `jwt-secret` | JWT signing secret |
| `anthropic-api-key` | Anthropic API key |
| `db-password` | PostgreSQL password |
| `servicebus-connection` | Service Bus connection string |

Functions and Container Apps reference Key Vault via managed identity.

## Risks / Trade-offs

- **StorageService abstraction**: introduces a second abstraction (`QueueService` is in `synthesis-extract`). Could be deferred — MinIO works fine if we don't use Azure Blob in Functions. Accept the complexity; MinIO is not available serverlessly.
- **Functions + PostgreSQL connection limits**: mitigated by small pool size per instance. If connection exhaustion occurs, add PgBouncer as a Container App.
- **KEDA cold start**: synthesis Container App scales from 0 in ~15-30s. Queue message stays locked during that time (5 min lock). No message loss.
