## Prerequisites

- [x] Azure subscription active, `az login` configured in CI
- [x] Terraform CLI installed locally

## 1. Terraform scaffold

- [x] 1.1 Create `infrastructure/` with `providers.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars.example`, `.gitignore` (`*.tfvars`, `.terraform/`, `terraform.tfstate*`)
- [x] 1.2 `main.tf` — resource group, locals (prefix, location)
- [x] 1.3 `postgres.tf` — PostgreSQL Flexible Server `Standard_B1ms`, SSL required, firewall rule `0.0.0.0`/`0.0.0.0` (allow Azure services)
- [x] 1.4 `storage.tf` — Storage Account LRS, `network_rules { default_action = "Deny", bypass = ["AzureServices"] }`
- [x] 1.5 `servicebus.tf` — Service Bus Namespace (Standard) + `synthesis-jobs` queue, lock duration 5 min
- [x] 1.6 `keyvault.tf` — Key Vault + access policies for Function App and synthesis managed identities; secrets: `jwt-secret`, `anthropic-api-key`, `db-password`, `servicebus-connection`, `storage-connection`
- [x] 1.7 `acr.tf` — Container Registry Basic, `admin_enabled = false`
- [x] 1.8 `functions.tf` — Consumption Plan + Function App (Linux, Node 20); App Settings per design table (KV refs for secrets, plain values for config); `AzureWebJobsStorage` = storage connection KV ref
- [x] 1.9 `container_apps.tf` — Container Apps Environment + synthesis app:
  - `ingress { external_enabled = false }` — not reachable from internet
  - KEDA Service Bus trigger, `min_replicas = 0`, `max_replicas = 5`
  - All env vars per design table; `API_BASE_URL` = `azurerm_linux_function_app.api.default_hostname`
  - `AcrPull` role assignment: synthesis managed identity → ACR
  - `registry { identity = "system" }` block for ACR pull via managed identity ← added post-deploy
- [x] 1.10 `static_web_apps.tf` — two Static Web App resources: console + landing (Free tier)
- [x] 1.11 `outputs.tf` — Function App URL, synthesis internal FQDN, Static Web App URLs, ACR login server, postgres FQDN

## 2. GitHub Actions — API deploy

- [ ] 2.1 Create `.github/workflows/deploy-api.yml`: trigger on push to `main` with changes in `applications/backend/api/**`
- [ ] 2.2 Steps: checkout → `npm ci` → `npm run build` → `func azure functionapp publish fabrick-api`
- [ ] 2.3 Add `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` to GitHub repository secrets

> **Note:** CI/CD not set up yet. API deployed manually via `func azure functionapp publish`. See deployment notes below.

## 3. GitHub Actions — synthesis deploy

- [ ] 3.1 Create `.github/workflows/deploy-containers.yml`: trigger on changes in `applications/backend/synthesis/**`
- [ ] 3.2 Steps: login to ACR → `docker build` + `docker push` synthesis image
- [ ] 3.3 Steps: `az containerapp update --image` for synthesis Container App
- [ ] 3.4 Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC) to GitHub secrets

> **Note:** Synthesis deployed manually. Must use `--platform linux/amd64` when building on Mac.

## 4. Static Web Apps — frontend deploy

- [x] 4.1 Add `VITE_API_URL` env var to build step in Static Web Apps GitHub Actions workflow — hardcoded as `https://api.fabrick.me` in `console-deploy.yml`
- [ ] 4.2 Add `API_URL` to GitHub repository secrets (set after first `terraform apply`) — not needed, URL is hardcoded

## 5. Infrastructure deploy

- [x] 5.1 `terraform init && terraform apply` against prod resource group
- [x] 5.2 Populate Key Vault secrets after first apply: `jwt-secret`, `anthropic-api-key`, `db-password`, `servicebus-connection`, `storage-connection`
- [x] 5.3 Set `API_URL` GitHub secret to Function App URL (from `terraform output`)
- [ ] 5.4 Add `terraform validate && terraform fmt -check` to CI on PR

## 6. Verify

- [x] 6.1 Confirm synthesis Container App has no external ingress
- [x] 6.2 Confirm postgres not reachable from outside Azure (firewall: Azure services only)
- [x] 6.3 Smoke test API: `GET /health` returns 200
- [x] 6.4 Trigger synthesis job, verify KEDA scales synthesis from 0
- [x] 6.5 Verify console loads from Static Web App URL, API calls succeed
- [ ] 6.6 Confirm local `docker-compose up` still works

---

## Deployment Notes (post-deploy findings)

**API deploy commands:**
```bash
cd applications/backend/api
npm run build
npm ci --omit=dev --legacy-peer-deps   # prod-only deps, ~19MB zip
func azure functionapp publish fabrick-api-b8743d --javascript
npm ci --legacy-peer-deps              # restore dev deps
```

**Synthesis deploy commands:**
```bash
cd applications/backend/synthesis
az acr login --name fabrickacrb8743d
docker buildx build --platform linux/amd64 -t fabrickacrb8743d.azurecr.io/synthesis:latest --push .
az containerapp update --name fabrick-synthesis --resource-group fabrick-prod --image fabrickacrb8743d.azurecr.io/synthesis:latest
```

**Issues found and fixed:**
- `node_modules` were excluded in `.funcignore` → removed exclusion
- TypeORM lacked SSL config → Azure PostgreSQL requires SSL → added `ssl: { rejectUnauthorized: false }`
- Container App `registry` block missing → ACR pull failed → added `registry { identity = "system" }`
- `AcrPull` role bound to stale principal after terraform recreate → reassigned manually
- Synthesis image was placeholder `containerapps-helloworld` → had to build+push real image
- Mac build produces arm64 image → Container Apps requires `linux/amd64` → use `buildx --platform`
