## 1. Terraform Remote State

- [ ] 1.1 Create Azure storage account `fabricktfstate` with blob container `tfstate` (manual or via separate tf config)
- [ ] 1.2 Add `infrastructure/backend.tf` with azurerm backend pointing to state storage account
- [ ] 1.3 Run `terraform init -migrate-state` locally to push existing state to blob backend
- [ ] 1.4 Verify `infrastructure/.gitignore` has `terraform.tfstate` and `terraform.tfstate.backup` entries

## 2. GitHub Repository Setup

- [ ] 2.1 Enable branch protection on `main`: require PR, require status checks (ci-unit, ci-e2e), no direct push
- [ ] 2.2 Enable branch protection on `develop`: require PR, require ci-unit status check
- [ ] 2.3 Add GitHub Actions secrets: `AZURE_CREDENTIALS`, `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`
- [ ] 2.4 Add GitHub Actions secrets: `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- [ ] 2.5 Add GitHub Actions secrets: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`, `DB_PASSWORD`, `JWT_SECRET`, `ANTHROPIC_API_KEY`

## 3. CI Unit Tests Workflow

- [ ] 3.1 Create `.github/workflows/ci-unit.yml` — triggers on PR and push to `develop`
- [ ] 3.2 Add jobs for API (`npm run test:unit`), CLI (`npm test`), MCP (`npm test`) running in parallel
- [ ] 3.3 Add Node 20 setup and per-app `npm ci` steps
- [ ] 3.4 Verify workflow completes without Azure secrets

## 4. CI E2e Tests Workflow

- [ ] 4.1 Create `.github/workflows/ci-e2e.yml` — triggers on push to `develop` and `release/*`
- [ ] 4.2 Add PostgreSQL service container (`postgres:16`, `POSTGRES_DB=fabrick_test`)
- [ ] 4.3 Add API e2e job: `npm ci`, `npm run test:e2e` with `DB_HOST=localhost` env var
- [ ] 4.4 Verify workflow does not require Azure secrets

## 5. CD Deploy Workflow

- [ ] 5.1 Create `.github/workflows/cd-deploy.yml` — triggers on push to `main`
- [ ] 5.2 Add deploy-api job: `npm ci --omit=dev --legacy-peer-deps`, `func azure functionapp publish`
- [ ] 5.3 Add deploy-synthesis job: `docker buildx build --platform linux/amd64`, `docker push`, `az containerapp update`
- [ ] 5.4 Configure `az login` using `AZURE_CREDENTIALS` secret (service principal JSON)

## 6. Ephemeral Staging Workflow

- [ ] 6.1 Create `.github/workflows/staging.yml` — triggers on push to `release/*`
- [ ] 6.2 Add terraform init + apply step with ARM secret env vars and backend-config
- [ ] 6.3 Add step to capture Terraform outputs (API URL, etc.) and export as env vars
- [ ] 6.4 Add user-journey test step: `npm install && npm test` in `tests/user-journey/`
- [ ] 6.5 Add log collection step with `if: failure()` — query Log Analytics, save to `logs/`
- [ ] 6.6 Add artifact upload step with `if: failure()` for `logs/` directory
- [ ] 6.7 Add terraform destroy step with `if: always()` — must run even on cancellation

## 7. Verification

- [ ] 7.1 Open test PR → verify ci-unit workflow runs and passes
- [ ] 7.2 Push to develop → verify ci-e2e workflow runs with postgres sidecar
- [ ] 7.3 Merge to main → verify cd-deploy deploys API and synthesis successfully
- [ ] 7.4 Push to `release/0.1` → verify staging workflow: apply → tests → destroy
