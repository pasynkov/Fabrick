## Context

Fabrick has three testable apps: API (Azure Functions, Jest), CLI (Node, Jest), MCP (Node, Jest). All have `npm test` or `npm run test:unit` scripts. No database or Azure services needed for unit tests.

## Goals / Non-Goals

**Goals:**
- Unit tests run automatically on push to `main`
- All three apps tested in parallel
- Workflow completes without any secrets

**Non-Goals:**
- Branch protection (gitflow-ci)
- E2e or integration tests (ci-release)
- Any deployment (cd-deploy)

## Decisions

### Workflow structure

```yaml
# .github/workflows/ci-unit.yml
name: CI Unit Tests
on:
  push:
    branches: [main]

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: applications/api
      - run: npm run test:unit
        working-directory: applications/api

  test-cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: applications/cli
      - run: npm test
        working-directory: applications/cli

  test-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: packages/mcp
      - run: npm test
        working-directory: packages/mcp
```

### Why parallel jobs, not matrix?

Apps have different `working-directory` and different test commands. Matrix would require per-app overrides that are harder to read than three explicit jobs.
