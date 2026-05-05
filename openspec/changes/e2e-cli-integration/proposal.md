## Why

The CI release pipeline has no integration test for the CLI or MCP layers — only the API is tested in isolation with mocked storage. A full data-path test is missing: a push through the real CLI hitting a real API with real blob storage, and an MCP read-back via stdio.

## What Changes

- Add `--token <token>` flag to `fabrick login` to skip browser-based OAuth flow (enables headless use in CI)
- Add `--non-interactive`, `--org <slug>`, `--project <slug>` flags to `fabrick init` to skip readline prompts
- Add `jest.e2e.config.js` + `test:e2e` script to the CLI package
- Add `applications/cli/test/integration.e2e.spec.ts`: full integration test hitting real API + Azurite
- Add `e2e-cli` job to `cd-release.yml` that runs after `e2e-api`, spins up API + Azurite, and runs CLI integration tests

## Capabilities

### New Capabilities

- `cli-headless-flags`: New CLI flags enabling non-interactive, token-based use of `login` and `init` commands
- `e2e-cli-integration-test`: Integration test suite for CLI + MCP covering the full data path: register → login → init → push → MCP read

### Modified Capabilities

- `cli-auth-flow`: `login` command gains a `--token` flag that bypasses the browser callback server
- `cli-testing`: CLI test suite gains a new `jest.e2e.config.js` config and `test:e2e` npm script for integration-level tests

## Impact

- `applications/cli/src/login.command.ts` — add `--token` option
- `applications/cli/src/init.command.ts` — add `--non-interactive`, `--org`, `--project` options
- `applications/cli/package.json` — add `test:e2e` script
- `applications/cli/jest.e2e.config.js` — new jest config for integration tests
- `applications/cli/test/integration.e2e.spec.ts` — new integration test
- `.github/workflows/cd-release.yml` — new `e2e-cli` job with Azurite service container
- No API changes; no new dependencies beyond `@azure/storage-blob` (already in API, needs adding to CLI dev deps for test setup)
