## Context

All backend services need Azure infrastructure. Resources defined as Terraform for repeatability. CI/CD deploys on push to `main`. MCP is an npm package — no cloud deployment needed.

**Network rule:** only Function App (API) and Static Web Apps (frontend) expose public HTTP endpoints. Synthesis has internal-only ingress. PostgreSQL restricted to Azure services only.

## Goals / Non-Goals

**Goals:**
- All resources defined in `infrastructure/` Terraform files
- Single `terraform apply` deploys everything to a resource group
- GitHub Actions deploys API (Functions) and synthesis (ACR → Container Apps)
- Static Web Apps for console and landing
- Secrets in Key Vault, referenced via managed identity
- Only API and frontend reachable from internet
- Local docker-compose unchanged

**Non-Goals:**
- Multi-region deployment
- Blue/green or canary deployments
- Preview environments per PR
- Remote Terraform state (local for now)
- Full VNet isolation (future upgrade; requires Functions Premium plan)

## File Layout

```
infrastructure/
  main.tf               provider, resource group, locals
  variables.tf
  outputs.tf            Function App URL, synthesis FQDN, Static Web App URLs
  providers.tf          azurerm, required_version
  terraform.tfvars.example
  .gitignore            *.tfvars, .terraform/, terraform.tfstate*
  postgres.tf
  storage.tf
  servicebus.tf
  keyvault.tf
  acr.tf
  functions.tf
  container_apps.tf
  static_web_apps.tf
```

## Resource Design

### Resource group layout

```
rg-fabrick-prod/
  fabrick-postgres        PostgreSQL Flexible Server (Standard_B1ms)
  fabrickstore            Storage Account (LRS)
  fabrick-servicebus      Service Bus Namespace (Standard)
    └── synthesis-jobs    Queue, lock duration 5 min
  fabrick-kv              Key Vault
  fabrick-acr             Container Registry (Basic)
  fabrick-api             Function App (Consumption, Linux, Node 20)  ← public
    └── fabrick-api-plan  Consumption Plan
  fabrick-cae             Container Apps Environment
    └── fabrick-synthesis Container App (KEDA, min 0)                 ← internal only
  fabrick-console         Static Web App (Free)                       ← public
  fabrick-landing         Static Web App (Free)                       ← public
```

### Network isolation

```
Internet
    │
    ├── fabrick-api (Function App)         ← HTTPS only, public
    ├── fabrick-console (Static Web App)   ← HTTPS only, public
    └── fabrick-landing (Static Web App)   ← HTTPS only, public

Azure internal only:
    fabrick-synthesis   ingress { external_enabled = false }
    fabrick-postgres    firewall: allow 0.0.0.0/0.0.0.0 (Azure services only flag)
    fabrickstore        network_rules { bypass = ["AzureServices"] }
    fabrick-servicebus  accessed via SDK + connection string from Key Vault only
    fabrick-acr         admin disabled, pull via managed identity
```

> **Future:** move to VNet + private endpoints for postgres/storage/servicebus.
> Requires Functions Premium plan (~$150/mo vs ~$0 Consumption). Not worth it for MVP.

### PostgreSQL

`Standard_B1ms` — 1 vCore, 2GB RAM, ~$12/mo. SSL required.
Firewall: `start_ip = "0.0.0.0"` + `end_ip = "0.0.0.0"` enables "Allow access from Azure services".
Consumption plan IPs are dynamic — no static IP range to allowlist.

### Storage Account

LRS. `network_rules { default_action = "Deny", bypass = ["AzureServices"] }`.
Blob containers created per-org dynamically by API.

### Service Bus

Standard tier. One namespace, one queue `synthesis-jobs`. Lock duration 5 min.
~$10/mo base + negligible per-message cost.

### Key Vault secrets

| Secret name              | Maps to env var                    |
|--------------------------|------------------------------------|
| `jwt-secret`             | `JWT_SECRET`                       |
| `anthropic-api-key`      | `ANTHROPIC_API_KEY`                |
| `db-password`            | `DB_PASS`                          |
| `servicebus-connection`  | `SERVICE_BUS_CONNECTION`           |
| `storage-connection`     | `AZURE_STORAGE_CONNECTION_STRING`  |

Function App and Container App access Key Vault via managed identity (`azurerm_key_vault_access_policy`).

### Function App (API) — complete App Settings

| Setting                          | Value                        | Source         |
|----------------------------------|------------------------------|----------------|
| `FUNCTIONS_WORKER_RUNTIME`       | `node`                       | plain          |
| `AzureWebJobsStorage`            | `<storage connection string>`| KV ref         |
| `DB_HOST`                        | postgres FQDN                | plain (output) |
| `DB_PORT`                        | `5432`                       | plain          |
| `DB_NAME`                        | `fabrick`                    | plain          |
| `DB_USER`                        | `fabrick`                    | plain          |
| `DB_PASS`                        | `@Microsoft.KeyVault(...)`   | KV ref         |
| `JWT_SECRET`                     | `@Microsoft.KeyVault(...)`   | KV ref         |
| `AZURE_STORAGE_CONNECTION_STRING`| `@Microsoft.KeyVault(...)`   | KV ref         |
| `SERVICE_BUS_CONNECTION`         | `@Microsoft.KeyVault(...)`   | KV ref         |
| `QUEUE_DRIVER`                   | `service-bus`                | plain          |

### Container App — Synthesis — complete env

| Env var                          | Value                    | Source               |
|----------------------------------|--------------------------|----------------------|
| `QUEUE_DRIVER`                   | `service-bus`            | plain                |
| `SERVICE_BUS_CONNECTION`         | secret ref               | Container App secret |
| `AZURE_STORAGE_CONNECTION_STRING`| secret ref               | Container App secret |
| `ANTHROPIC_API_KEY`              | secret ref               | Container App secret |
| `API_BASE_URL`                   | Function App URL         | Terraform output ref |

`API_BASE_URL` depends on `azurerm_linux_function_app.api.default_hostname` — Terraform resolves this automatically since both resources are in the same config.

### Container App — Synthesis (KEDA)

```hcl
ingress {
  external_enabled = false   # not reachable from internet
  target_port      = 3000
}

resources {
  cpu    = 0.5
  memory = "1.0Gi"
}

scale {
  min_replicas = 0
  max_replicas = 5
  rules = [{
    name   = "service-bus-trigger"
    custom = {
      type     = "azure-servicebus"
      metadata = { queueName = "synthesis-jobs", messageCount = "1" }
      auth     = [{ secret_ref = "servicebus-connection", trigger_parameter = "connection" }]
    }
  }]
}
```

### ACR + managed identity

`admin_enabled = false`. Container App needs `AcrPull` role:

```hcl
resource "azurerm_role_assignment" "synthesis_acr_pull" {
  principal_id         = azurerm_container_app.synthesis.identity[0].principal_id
  role_definition_name = "AcrPull"
  scope                = azurerm_container_registry.acr.id
}
```

### Static Web Apps

Two resources: `fabrick-console` and `fabrick-landing`. Free tier.
`VITE_API_URL` must be set as a build env var in the GitHub Actions deploy step:

```yaml
- uses: azure/static-web-apps-deploy@v1
  with:
    app_build_command: "npm run build"
  env:
    VITE_API_URL: ${{ secrets.API_URL }}  # set after first terraform apply
```

### CI/CD

**`deploy-api.yml`** (trigger: `applications/backend/api/**`):
1. `npm ci && npm run build`
2. `func azure functionapp publish fabrick-api`

**`deploy-containers.yml`** (trigger: `applications/backend/synthesis/**`):
1. Login to ACR
2. `docker build` + `docker push` synthesis image
3. `az containerapp update --image` for synthesis

Static Web Apps: auto-generated workflow by Azure on resource creation. Add `VITE_API_URL` env to build step.

## Risks / Trade-offs

- **Functions + PostgreSQL**: "Allow Azure services" firewall is not truly private — any Azure tenant can reach the endpoint. Mitigated by strong password + SSL. VNet integration is the proper fix (future).
- **KEDA cold start**: synthesis scales from 0 in ~15-30s. Queue lock duration 5 min covers this. No message loss.
- **Functions connection pool**: `max: 2` already set in TypeORM config. Monitor if exhausted under load.
- **Local Terraform state**: committed to repo. `terraform.tfvars` (contains secrets) must be gitignored — only `terraform.tfvars.example` committed.
