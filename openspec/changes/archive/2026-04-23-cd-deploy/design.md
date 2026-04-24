## Context

With CI gating the path to `main`, automated deployment closes the loop. Push to `main` = production deploy. Two artifacts: API (Azure Functions) and synthesis worker (Azure Container App).

## Goals / Non-Goals

**Goals:**
- Merge to `main` triggers deploy of API and synthesis
- API deployed via `func azure functionapp publish` using publish profile
- Synthesis deployed via `docker push` + `az containerapp update`
- All Azure credentials stored as GitHub Actions secrets

**Non-Goals:**
- Console deploy (handled by Azure Static Web Apps GitHub integration automatically)
- Terraform infrastructure changes (manual for now, ephemeral-staging change covers tf state)
- Rollback automation (manual)

## Decisions

### Workflow structure

```yaml
# .github/workflows/cd-deploy.yml
name: CD Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci --omit=dev --legacy-peer-deps
        working-directory: applications/api
      - uses: Azure/functions-action@v1
        with:
          app-name: fabrick-api
          package: applications/api
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}

  deploy-synthesis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - run: |
          docker buildx build --platform linux/amd64 \
            -t ${{ secrets.REGISTRY_LOGIN_SERVER }}/synthesis:${{ github.sha }} \
            -f applications/synthesis/Dockerfile .
          docker push ${{ secrets.REGISTRY_LOGIN_SERVER }}/synthesis:${{ github.sha }}
        env:
          DOCKER_BUILDKIT: 1
      - run: |
          az containerapp update \
            --name fabrick-synthesis \
            --resource-group fabrick-rg \
            --image ${{ secrets.REGISTRY_LOGIN_SERVER }}/synthesis:${{ github.sha }}
```

### Why two separate jobs?

API and synthesis deploy independently — parallel execution halves total deploy time. A failure in one doesn't block the other (partial deploys are acceptable; each artifact is independently versioned).

### Secrets required

| Secret | Used by |
|--------|---------|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | deploy-api |
| `AZURE_CREDENTIALS` | deploy-synthesis (az login) |
| `REGISTRY_LOGIN_SERVER` | deploy-synthesis |
| `REGISTRY_USERNAME` | docker login (if needed) |
| `REGISTRY_PASSWORD` | docker login (if needed) |
| `ANTHROPIC_API_KEY` | synthesis runtime env (set via az containerapp update --set-env-vars) |
