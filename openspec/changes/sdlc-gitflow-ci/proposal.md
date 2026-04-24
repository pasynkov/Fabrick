## Why

Fabrick has no end-to-end SDLC automation. CI runs only on `main` and `develop`. There is no feature branch testing, no automated PRs, no release process, and deployment triggers incorrectly on push to `main`. This change implements a complete gitflow-based SDLC: feature branches → develop → release → main, with automated gates at each transition.

## What Changes

- Unit tests run on `feature/**` push; on pass, PR to `develop` opens automatically
- Mock required check runs on every PR to `develop` (placeholder for future gate logic)
- E2E tests run on push to `develop` and `release/**`
- Deployment becomes a manual `workflow_dispatch` from a `release/*` branch, not an auto-push to `main`
- Deployment bumps `package.json` versions across api, synthesis, console, landing from branch name
- After deploy, PR to `main` opens automatically
- When PR merges to `main`, tag `vX.X.X` is created and PR `main → develop` opens automatically

Release branch (`release/vX.X.X`) is created manually by the developer for now.

## Capabilities

### New Capabilities

- `ci-pr-check`: mock required status check on PR to `develop`
- `cd-release-finalize`: tags `main` and opens sync PR to `develop` on release PR merge

### Modified Capabilities

- `ci-unit`: add `feature/**` trigger + `open-pr` job
- `ci-e2e`: add `develop` trigger
- `cd-deploy`: change trigger to `workflow_dispatch`, add version bump + auto PR to `main`

## Impact

- `.github/workflows/ci-unit.yml` — add `feature/**` push trigger and `open-pr` job
- `.github/workflows/ci-e2e.yml` — add `develop` push trigger
- `.github/workflows/ci-pr-check.yml` — new, mock required check
- `.github/workflows/cd-deploy.yml` — rework trigger, add bump + finalize jobs
- `.github/workflows/cd-release-finalize.yml` — new, tag + sync PR

No new secrets required. `GITHUB_TOKEN` is sufficient for all operations.
