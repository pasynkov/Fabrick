## Why

Fabrick has no automated CI. All testing is manual from developer laptops. Adding CI on `main` is the smallest useful slice: every push gets tested without changing branch strategy or requiring secrets.

## What Changes

- Add GitHub Actions workflow that runs unit tests on push to `main`
- Tests run in parallel: API, CLI, MCP
- No Azure secrets required — pure Node.js test run
- No branch protection rules (added in gitflow-ci)

## Capabilities

### New Capabilities

- `ci-unit-main`: GitHub Actions workflow running unit tests on push to `main`

### Modified Capabilities

_(none)_

## Impact

- `.github/workflows/ci-unit.yml` — new workflow, trigger: push to `main`
- No secrets configuration required
- No repository settings changes
