## Context

Fabrick currently has no CI/CD. Deployments are fully manual from developer laptops. Terraform state is local (not in source control). The codebase is a public GitHub repo with three deployable artifacts: API (Azure Functions), synthesis worker (Container App), console (Azure Static Web App). Infrastructure is Terraform-managed.

## Goals / Non-Goals

**Goals:**
- GitHub Actions CI running unit tests on every PR
- GitHub Actions CI running e2e tests (postgres sidecar) on develop/release
- GitHub Actions CD deploying API and synthesis on merge to main
- Ephemeral staging environment workflow for release branches
- Terraform remote state in Azure Blob Storage

**Non-Goals:**
- Multi-region deployment
- Blue/green or canary releases
- Rollback automation (manual for now)
- Console deploy (already handled by Azure Static Web Apps GitHub integration)

## Decisions

### Branch strategy

```
feature/* ──┐
             ├──► develop ──► release/x.y ──► main
hotfix/* ───┘                                  │
                                               └──► tag vX.Y.Z
```

- PR required for develop and main
- CI must be green before merge
- Release branch created manually when ready to ship

### Workflow structure

```
.github/workflows/
  ci-unit.yml      ← triggers: PR, push to develop/*
  ci-e2e.yml       ← triggers: push to develop, release/*
  cd-deploy.yml    ← triggers: push to main
  staging.yml      ← triggers: push to release/* (ephemeral Azure)
```

**Why separate files?** Each workflow has different triggers, secrets, and runner requirements. A single file with conditionals becomes hard to reason about.

### CI unit workflow

```yaml
# ci-unit.yml
on: [pull_request, push to develop]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node 20
      - npm ci (api, cli, mcp)
      - npm run test:unit (each app)
```

No external services. Fast (~2-3 min).

### CI e2e workflow

```yaml
# ci-e2e.yml
on: [push to develop, push to release/*]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: POSTGRES_DB=fabrick_test, POSTGRES_PASSWORD=test
    steps:
      - npm run test:e2e (api)
      - npm test (cli, mcp — unit only, no extra infra)
```

Azure services (Blob, Service Bus) mocked in test code — no Azure credentials needed here.

### CD deploy workflow

```yaml
# cd-deploy.yml
on: [push to main]
jobs:
  deploy-api:
    steps:
      - npm ci --omit=dev --legacy-peer-deps
      - func azure functionapp publish fabrick-api-<suffix>
  deploy-synthesis:
    steps:
      - docker buildx build --platform linux/amd64 -t <acr>/synthesis:latest
      - docker push
      - az containerapp update --image <acr>/synthesis:latest
```

Requires secrets: `AZURE_CREDENTIALS` (service principal), `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`.

### Ephemeral staging workflow

```yaml
# staging.yml
on: [push to release/*]
jobs:
  staging:
    steps:
      - terraform init -backend-config=...
      - terraform apply -auto-approve
      - npm run test:journey (user-journey-e2e suite)
      - terraform destroy -auto-approve  # always, even on test failure
```

**Why always destroy?** Billing. Ephemeral environments must not linger.

On test failure: collect logs from Log Analytics before destroy, upload as GitHub Actions artifact.

### Terraform remote state

```hcl
# infrastructure/backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "fabrick-rg"
    storage_account_name = "fabricktfstate"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}
```

Separate storage account from app storage (different lifecycle, different access). State lock via blob lease (built-in).

CI needs `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID` for auth.

### GitHub Actions secrets required

| Secret | Used by |
|--------|---------|
| `AZURE_CREDENTIALS` | CD deploy (az login) |
| `ARM_CLIENT_ID` / `ARM_CLIENT_SECRET` / `ARM_SUBSCRIPTION_ID` / `ARM_TENANT_ID` | Terraform in staging |
| `REGISTRY_LOGIN_SERVER` / `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | docker push |
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | func publish |
| `DB_PASSWORD` | Staging terraform vars |
| `JWT_SECRET` | Staging terraform vars |
| `ANTHROPIC_API_KEY` | Staging terraform vars |

## Risks / Trade-offs

- **Staging cost** — Each release branch run spins up full Azure infra (~$0.10-0.50 per run). Acceptable for now.
- **Terraform state migration** — Existing local state must be pushed to blob backend once (`terraform init -migrate-state`). One-time manual step.
- **func publish profile rotation** — Publish profiles expire or rotate on infra changes. Must re-download after terraform apply.
- **ARM credentials scope** — Service principal for staging needs broad permissions (create/destroy all resources). Scope to resource group, not subscription.
