## MODIFIED Requirements

### Requirement: Post-deployment version validation job
The CI/CD pipeline (cd-release.yml) SHALL include a validation step that runs after all deployments complete to verify deployed application versions match expected version.

#### Scenario: Validation checks API version
- **WHEN** validation job executes after API deployment
- **THEN** job calls `GET /health` endpoint on deployed API
- **AND** compares returned `'app-version'` value against expected version from release branch
- **AND** job passes if versions match

#### Scenario: Validation checks frontend versions
- **WHEN** validation job executes after frontend deployments
- **THEN** job calls `GET /health.json` on each deployed frontend (Console, Landing, Admin)
- **AND** for the Admin SPA the URL is `https://console.fabrick.me/admin/health.json` (served as a subpath of the console Static Web App)
- **AND** compares returned `version` value against expected version from release branch
- **AND** job passes if all versions match

#### Scenario: Validation fails on version mismatch
- **WHEN** any deployed application reports version different from expected
- **THEN** validation job fails with clear error message: `<app-name> version mismatch`
- **AND** CI/CD pipeline stops with error status
