## Prerequisites

- [ ] All four preceding changes complete and deployed locally
- [ ] Azure subscription active, `az login` configured in CI

## 1. Bicep modules

- [ ] 1.1 Create `infrastructure/` directory with `main.bicep` and `modules/` subdirectory
- [ ] 1.2 `modules/postgres.bicep` — PostgreSQL Flexible Server, `Standard_B1ms`, SSL required
- [ ] 1.3 `modules/storage.bicep` — Storage Account (LRS), blob containers created per-org dynamically by API on org creation
- [ ] 1.4 `modules/servicebus.bicep` — Service Bus Namespace (Standard) + `synthesis-jobs` queue, lock duration 5 min
- [ ] 1.5 `modules/keyvault.bicep` — Key Vault with secrets: `jwt-secret`, `anthropic-api-key`, `db-password`, `servicebus-connection`
- [ ] 1.6 `modules/acr.bicep` — Container Registry (Basic)
- [ ] 1.7 `modules/functions.bicep` — Function App (Consumption, Linux, Node 20), Application Settings referencing Key Vault
- [ ] 1.8 `modules/container-apps.bicep` — Container Apps Environment + MCP app (min 1) + synthesis app (KEDA, min 0)
- [ ] 1.9 `main.bicep` — wires all modules, outputs Function App URL and Container App FQDNs

## 2. StorageService abstraction

- [ ] 2.1 Define `StorageService` interface: `getObject`, `putObject`, `listObjects`, `ensureBucket`
- [ ] 2.2 Implement `MinioStorageService` (wraps existing `MinioService`, `STORAGE_DRIVER=minio`)
- [ ] 2.3 Implement `AzureBlobStorageService` using `@azure/storage-blob` (`STORAGE_DRIVER=azure-blob`, `AZURE_STORAGE_CONNECTION` env var)
- [ ] 2.4 Replace direct `MinioService` usage in API and synthesis service with `StorageService` token

## 3. GitHub Actions — API deploy

- [ ] 3.1 Create `.github/workflows/deploy-api.yml`: trigger on push to `main` with changes in `applications/backend/api/**`
- [ ] 3.2 Steps: checkout → `npm ci` → `npm run build` → `func azure functionapp publish fabrick-api`
- [ ] 3.3 Add `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` to GitHub repository secrets

## 4. GitHub Actions — containers deploy

- [ ] 4.1 Create `.github/workflows/deploy-containers.yml`: trigger on changes in `applications/backend/mcp/**` or `applications/backend/synthesis/**`
- [ ] 4.2 Steps: login to ACR → `docker build` + `docker push` for MCP and synthesis images
- [ ] 4.3 Steps: `az containerapp update --image` for each Container App to deploy new revision
- [ ] 4.4 Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC) to GitHub secrets

## 5. Infrastructure deploy

- [ ] 5.1 Create `infrastructure/deploy.sh` for one-time initial deployment: `az deployment group create --template-file main.bicep`
- [ ] 5.2 Populate Key Vault secrets after first deploy (manual step, documented in `infrastructure/README.md`)
- [ ] 5.3 Add Bicep linting to CI (`az bicep build --file main.bicep` on PR)

## 6. Verify

- [ ] 6.1 Deploy to staging resource group, run smoke tests against API URL
- [ ] 6.2 Trigger synthesis job via console, verify KEDA scales synthesis Container App from 0
- [ ] 6.3 Verify MCP tool calls work against production API URL
- [ ] 6.4 Confirm local `docker-compose up` still works with `STORAGE_DRIVER=minio`, `QUEUE_DRIVER=nats`
