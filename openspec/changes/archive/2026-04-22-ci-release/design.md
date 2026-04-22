## Context

`gitflow-ci` established the develop/feature flow. Release branches (`release/x.y`) are cut from `develop` when ready to ship. They need heavier CI: e2e tests against real Postgres to catch integration issues before merge to `main`.

## Goals / Non-Goals

**Goals:**
- E2e tests run automatically on push to `release/*`
- Postgres available as service container
- `release/*` protected: require `ci-e2e` green before merge to `main`
- Minimal secrets scope (no Azure credentials)

**Non-Goals:**
- Ephemeral staging environment (separate change)
- User journey tests (e2e-user-journey change)
- Deployment (cd-deploy)

## Decisions

### Workflow structure

```yaml
# .github/workflows/ci-e2e.yml
name: CI E2E Tests
on:
  push:
    branches: ['release/**']

jobs:
  e2e-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: fabrick_test
          POSTGRES_PASSWORD: ${{ secrets.DB_PASSWORD }}
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: applications/api
      - run: npm run test:e2e
        working-directory: applications/api
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: fabrick_test
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Why trigger only on release/*, not develop?

E2e tests are slow and require secrets. Keeping them off `develop` keeps the fast PR feedback loop clean. `release/*` is the gate before `main` — right place for the expensive check.

### Branch protection on release/*

GitHub supports wildcard patterns for branch protection. Set `release/**` rule:
- Require PR to merge to `main`
- Required status check: `ci-e2e / e2e-api`
