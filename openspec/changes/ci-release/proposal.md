## Why

Release branches need heavier CI: e2e tests against a real Postgres instance to catch integration issues before merge to main. This adds a separate workflow triggered only on `release/*` pushes, keeping e2e costs out of the fast PR loop.

## What Changes

- Add GitHub Actions workflow for e2e tests with Postgres service container
- Triggers on push to `release/*`
- Enable branch protection on `release/*`: require `ci-e2e` status check green before merge to main
- Add GitHub Actions secrets needed for e2e: `DB_PASSWORD`, `JWT_SECRET`

## Capabilities

### New Capabilities

- `ci-e2e`: GitHub Actions workflow running e2e tests with Postgres on `release/*` pushes

### Modified Capabilities

_(none)_

## Impact

- `.github/workflows/ci-e2e.yml` — new workflow
- GitHub repository settings — branch protection on `release/*`
- GitHub Actions secrets: `DB_PASSWORD`, `JWT_SECRET`
