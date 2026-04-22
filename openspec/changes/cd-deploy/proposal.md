## Why

With CI green on the path to `main`, automated deployment closes the loop: merge to `main` triggers deploy of API (Azure Functions) and synthesis worker (Container App). Eliminates manual `func publish` and `docker push` from developer laptops.

## What Changes

- Add GitHub Actions workflow that deploys on push to `main`
- Deploy API: `func azure functionapp publish` using publish profile
- Deploy synthesis: `docker buildx build --platform linux/amd64`, `docker push`, `az containerapp update`
- Add all required Azure secrets to GitHub Actions

## Capabilities

### New Capabilities

- `cd-deploy`: GitHub Actions workflow deploying API and synthesis on merge to main

### Modified Capabilities

_(none)_

## Impact

- `.github/workflows/cd-deploy.yml` — new workflow
- GitHub Actions secrets: `AZURE_CREDENTIALS`, `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`, `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`, `ANTHROPIC_API_KEY`
