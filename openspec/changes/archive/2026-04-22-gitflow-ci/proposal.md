## Why

After CI runs on `main`, the next step is proper branch hygiene: `develop` as integration branch, `feature/*` convention, branch protection on `main` and `develop`. CI expands to trigger on all PRs and pushes to `develop`.

## What Changes

- Create `develop` branch from `main`
- Enable branch protection on `main`: require PR, require `ci-unit` status check green, no direct push
- Enable branch protection on `develop`: require PR, require `ci-unit` status check green
- Extend `ci-unit.yml` triggers: add `pull_request` and `push to develop`
- Document `feature/*` branching convention

## Capabilities

### New Capabilities

- `gitflow-strategy`: develop branch, feature/* convention, protection rules on main + develop

### Modified Capabilities

- `ci-unit-main` → `ci-unit`: extends triggers to PR and push to develop

## Impact

- `.github/workflows/ci-unit.yml` — update triggers
- GitHub repository settings — branch protection on `main` and `develop`
- No new secrets required
