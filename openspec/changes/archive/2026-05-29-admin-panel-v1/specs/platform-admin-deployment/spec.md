## ADDED Requirements

### Requirement: Console Static Web App routes /admin/* to the admin SPA
`applications/console/public/staticwebapp.config.json` SHALL be updated so that the merged bundle correctly serves two SPAs from one Azure Static Web App. Concretely, the navigation fallback SHALL exclude `/admin/*` and `/assets/*`, and there SHALL be explicit route rewrites mapping `/admin` and `/admin/*` to `/admin/index.html`.

#### Scenario: Console root routes still work
- **WHEN** a client requests an arbitrary console route such as `/projects/abc`
- **THEN** the SWA SHALL serve `/index.html` (console SPA fallback) as before

#### Scenario: Admin routes hit admin index
- **WHEN** a client requests `/admin` or `/admin/users` or `/admin/projects/abc`
- **THEN** the SWA SHALL serve `/admin/index.html` (admin SPA fallback)

#### Scenario: Static assets pass through
- **WHEN** a client requests `/admin/assets/index-abc123.js`
- **THEN** the SWA SHALL serve the static file directly without SPA fallback rewrite

### Requirement: Merged-build deploy pipeline ships admin under /admin
The `deploy-console` job in `.github/workflows/cd-release.yml` SHALL build both the console and the admin app, copy the admin `dist/` into `applications/console/dist/admin/`, and upload the merged tree via the existing `Azure/static-web-apps-deploy@v1` step. The job SHALL fail the release if either build fails.

#### Scenario: Merged tree uploaded to SWA
- **WHEN** the release workflow runs `deploy-console`
- **THEN** the job SHALL run `npm ci` and `npm run build` in both `applications/console` and `applications/admin`
- **AND** the job SHALL copy `applications/admin/dist/*` into `applications/console/dist/admin/`
- **AND** the `Azure/static-web-apps-deploy@v1` step SHALL be configured with `app_location: applications/console/dist` and `skip_app_build: true`

#### Scenario: Admin build failure fails the release
- **WHEN** `npm run build` in `applications/admin` exits non-zero during `deploy-console`
- **THEN** the job SHALL fail before invoking the deploy action

### Requirement: Parallel CI build job for the admin app
The CI workflow `.github/workflows/ci-unit.yml` (or its successor that builds frontend apps) SHALL include a `build-admin` job running independently of (in parallel with) the existing `build-console`, `test-api`, `test-cli`, and `test-mcp` jobs. The job SHALL run `npm ci --legacy-peer-deps` and `npm run build` in `applications/admin/` on Node 24.

#### Scenario: CI runs admin build alongside console build
- **WHEN** CI runs on a push or pull request
- **THEN** the `build-admin` job SHALL appear as a top-level job in the workflow
- **AND** it SHALL be scheduled in parallel with the console build job (no `needs` dependency between them)

#### Scenario: Admin build failure blocks merge
- **WHEN** the `build-admin` job fails
- **THEN** the workflow SHALL report failure (current CI required-checks behavior)

### Requirement: Version-bump step covers the admin package
The version-bump step in `cd-release.yml` SHALL include `applications/admin/package.json` in the list of `package.json` files it updates so admin's `health.json` stays in sync with the release tag.

#### Scenario: Admin package.json version updated on release
- **WHEN** the version-bump step runs for a release
- **THEN** it SHALL update the `version` field in `applications/admin/package.json` to the release version, alongside the existing console/landing/api/cli/mcp packages

### Requirement: Post-deploy verification checks /admin/health.json
The `verify-deployment` step in `cd-release.yml` SHALL verify `https://console.fabrick.me/admin/health.json` returns HTTP 200 with a `version` field matching the released version, using the same pattern already used for `console.fabrick.me/health.json`.

#### Scenario: Admin health check passes
- **WHEN** the merged build has been deployed
- **THEN** `verify-deployment` SHALL successfully fetch `https://console.fabrick.me/admin/health.json` and assert its `version` equals the release version

#### Scenario: Admin health check fails
- **WHEN** `https://console.fabrick.me/admin/health.json` returns a missing version or a stale version
- **THEN** `verify-deployment` SHALL fail the release pipeline (same as the existing console check)
