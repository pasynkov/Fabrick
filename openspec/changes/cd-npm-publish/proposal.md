## Why

CI/CD deploys API, synthesis, console, and landing but npm package publishing (`@fabrick/cli`, `@fabrick/mcp`) is absent — releases are done manually. We need automated publishing with explicit version bump selection (patch/minor/major).

## What Changes

- New GitHub Actions workflow `cd-npm-publish.yml` with `workflow_dispatch` trigger
- Input parameters: `version_bump` (patch / minor / major) and `package` (cli / mcp / both)
- Workflow: bump version → build → publish → create git tag and commit
- `NPM_TOKEN` added as GitHub secret for npm registry authorization

## Capabilities

### New Capabilities

- `npm-publish`: Manual CI/CD workflow to bump version and publish `@fabrick/cli` and/or `@fabrick/mcp` to npm with patch/minor/major selection

### Modified Capabilities

## Impact

- `.github/workflows/cd-npm-publish.yml` — new file
- `applications/cli/package.json` — version bumped within workflow
- `applications/mcp/package.json` — version bumped within workflow
- New GitHub secret: `NPM_TOKEN`
