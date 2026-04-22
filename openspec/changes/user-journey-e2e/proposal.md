## Why

Unit and e2e integration tests verify individual components in isolation, but do not catch failures in the full system when all real Azure services interact. A user-journey test suite runs the complete Fabrick flow against a real ephemeral Azure environment to verify the product works end-to-end before each release.

## What Changes

- Add user-journey test suite that runs the full Fabrick flow: register → create org → create repo → push context → trigger synthesis → poll until complete → verify output
- Tests run against a real ephemeral Azure environment (Functions API + PostgreSQL + Blob Storage + Service Bus + Container Apps synthesis)
- Test suite is invoked from CI as part of the `staging` workflow on `release/*` branches
- Environment is always torn down after tests (pass or fail), logs collected on failure

## Capabilities

### New Capabilities

- `user-journey-testing`: End-to-end test suite that exercises the complete Fabrick product flow against real Azure infrastructure, from user registration through synthesis result retrieval

### Modified Capabilities

_(no requirement changes to existing capabilities)_

## Impact

- `tests/user-journey/` — new test suite directory (TypeScript + jest or playwright)
- `tests/user-journey/package.json` — standalone test package with own dependencies
- `tests/user-journey/jest.config.js` — long timeout config (synthesis can take 60-120s)
- `.github/workflows/staging.yml` — invokes this suite after terraform apply
- Requires: ephemeral Azure environment with all infra deployed (cicd-pipeline change)
- Requires: `@fabrick/cli` installed or built locally to drive CLI commands
