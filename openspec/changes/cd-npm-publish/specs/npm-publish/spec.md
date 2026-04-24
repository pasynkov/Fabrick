## ADDED Requirements

### Requirement: Manual publish workflow trigger
The system SHALL provide a `workflow_dispatch` GitHub Actions workflow that accepts two inputs: `package` (cli / mcp / both) and `version_bump` (patch / minor / major).

#### Scenario: Trigger with valid inputs
- **WHEN** a user manually triggers the workflow with `package=cli` and `version_bump=patch`
- **THEN** the workflow runs only for the `@fabrick/cli` package and bumps its patch version

#### Scenario: Trigger with `both`
- **WHEN** a user triggers the workflow with `package=both`
- **THEN** the workflow runs for both `@fabrick/cli` and `@fabrick/mcp` packages independently

### Requirement: Version bump and commit
The workflow SHALL use `npm version <bump>` to increment the package version and commit the change. Git tags are out of scope and SHALL NOT be created or pushed.

#### Scenario: Successful version bump
- **WHEN** `npm version patch` runs for `@fabrick/cli` at version `0.6.1`
- **THEN** `package.json` version becomes `0.6.2` and a git commit is pushed to the branch

#### Scenario: No git tags created
- **WHEN** version bump completes
- **THEN** no git tags are created or pushed to the remote repository

### Requirement: npm publish to registry
The workflow SHALL build the package and publish it to the npm registry using `NPM_TOKEN` secret.

#### Scenario: Successful publish
- **WHEN** build succeeds and `NPM_TOKEN` is valid
- **THEN** the package is published to npm and visible at `https://www.npmjs.com/package/<name>`

#### Scenario: Missing NPM_TOKEN
- **WHEN** `NPM_TOKEN` secret is not configured
- **THEN** the workflow fails at the publish step with an authentication error

### Requirement: Concurrent run protection
The workflow SHALL use a `concurrency` group per package to prevent simultaneous publish runs for the same package.

#### Scenario: Concurrent runs blocked
- **WHEN** a second workflow run is triggered for the same package while one is already in progress
- **THEN** the second run is queued or cancelled, preventing version collision
