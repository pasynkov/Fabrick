## 1. Add Azure secrets to GitHub Actions

- [x] 1.1 Add `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` — download from Azure portal (fabrick-api → Get publish profile)
- [x] 1.2 Add `AZURE_CREDENTIALS` — service principal JSON (`az ad sp create-for-rbac --sdk-auth`)
- [x] 1.3 Add `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` — from Azure Container Registry
- [x] 1.4 Add `ANTHROPIC_API_KEY` — for synthesis runtime env update

## 2. Create workflow

- [x] 2.1 Create `.github/workflows/cd-deploy.yml` with trigger `push: branches: [main]`
- [x] 2.2 Add `deploy-api` job using `Azure/functions-action@v1` with publish profile
- [x] 2.3 Add `deploy-synthesis` job: az login, docker buildx build (linux/amd64), docker push, az containerapp update
- [x] 2.4 Confirm both jobs run in parallel (no `needs:` dependency between them)

## 3. Verify

- [x] 3.1 Merge test PR to `main` → confirm both deploy jobs trigger
- [x] 3.2 Verify API deploy succeeds: `curl https://api.fabrick.me/health` → `{"status":"ok"}`
- [x] 3.3 Verify synthesis deploy succeeds: check container revision updated in Azure portal
- [x] 3.4 Confirm `ANTHROPIC_API_KEY` propagated to new synthesis revision
