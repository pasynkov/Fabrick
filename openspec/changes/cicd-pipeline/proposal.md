## Why

Fabrick has no automated CI/CD. All deployments are manual (`func publish`, `docker push`, `terraform apply` from local). This blocks safe iteration, makes releases error-prone, and prevents team collaboration at scale.

## What Changes

- Add GitHub Actions workflows for CI (unit tests on every PR, e2e tests on develop/release)
- Add GitHub Actions workflow for CD (deploy API and synthesis on release branch merge to main)
- Implement gitflow branch strategy: `feature/*` → `develop` → `release/*` → `main`
- Protect `main` and `develop` branches (require CI green, require PR)
- Store Terraform state in Azure Blob Storage backend (replaces local state)
- Add workflow for ephemeral staging environment on `release/*` (terraform apply → run user-journey e2e → terraform destroy)
- Add npm scripts and Makefile targets to support CI invocation

## Capabilities

### New Capabilities

- `ci-unit-tests`: GitHub Actions workflow that runs unit tests on every PR and push to develop
- `ci-e2e-tests`: GitHub Actions workflow that runs e2e tests (postgres sidecar) on develop and release branches
- `cd-deploy`: GitHub Actions workflow that deploys API (func publish) and synthesis (docker push + container app update) on merge to main
- `ephemeral-staging`: GitHub Actions workflow for release branches — spins up full Azure environment, runs user-journey tests, always destroys regardless of outcome
- `terraform-remote-state`: Azure Blob Storage backend for Terraform state, replacing local state file

### Modified Capabilities

_(no requirement changes to existing capabilities)_

## Impact

- `.github/workflows/ci-unit.yml` — new workflow
- `.github/workflows/ci-e2e.yml` — new workflow
- `.github/workflows/cd-deploy.yml` — new workflow
- `.github/workflows/staging.yml` — new workflow (release/* only)
- `infrastructure/backend.tf` — Terraform Azure blob backend config
- GitHub repository settings — branch protection rules for `main` and `develop`
- GitHub Actions secrets — `AZURE_CREDENTIALS`, `ARM_*`, `NPM_TOKEN`, `DB_PASSWORD`, `JWT_SECRET`, etc.
- New dependencies: none (GitHub Actions built-in runners)
