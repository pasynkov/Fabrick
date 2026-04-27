## ADDED Requirements

### Requirement: Post-deployment version validation job
The CI/CD pipeline (cd-release.yml) SHALL include a validation step that runs after all deployments complete to verify deployed application versions match expected version.

#### Scenario: Validation checks API version
- **WHEN** validation job executes after API deployment
- **THEN** job calls `GET /health` endpoint on deployed API
- **AND** compares returned `'app-version'` value against expected version from release branch
- **AND** job passes if versions match

#### Scenario: Validation checks frontend versions
- **WHEN** validation job executes after frontend deployments
- **THEN** job calls `GET /health.json` on each deployed frontend (Console, Landing)
- **AND** compares returned `version` value against expected version from release branch
- **AND** job passes if all versions match

#### Scenario: Validation fails on version mismatch
- **WHEN** any deployed application reports version different from expected
- **THEN** validation job fails with clear error message: `<app-name> version mismatch`
- **AND** CI/CD pipeline stops with error status

### Requirement: Version extraction from release branch
The validation job SHALL extract expected version from the release branch reference used for deployment.

#### Scenario: Version extracted from release context
- **WHEN** cd-release.yml pipeline executes
- **THEN** validation step knows the version that was deployed (from release branch/tag)
- **AND** uses this as the expected version for all checks

### Requirement: Retry logic for version checks
The validation checks SHALL include retry logic to handle transient network issues.

#### Scenario: Transient network failure is retried
- **WHEN** a version check fails due to network timeout
- **THEN** validation job retries the check (max 3 attempts)
- **AND** succeeds if any attempt returns expected version
