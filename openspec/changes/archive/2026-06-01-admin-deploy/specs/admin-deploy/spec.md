## ADDED Requirements

### Requirement: Admin SPA served as subpath of console Static Web App
The admin SPA SHALL be deployed inside the console Azure Static Web App at the `/admin/` URL prefix, and SHALL NOT have its own Static Web App resource, custom domain, or DNS record.

#### Scenario: Admin root resolves through console host
- **WHEN** a client requests `https://console.fabrick.me/admin/`
- **THEN** the console Static Web App responds with the admin SPA's `index.html`
- **AND** the response is rendered against vite `base: '/admin/'`

#### Scenario: Admin client-side route is rewritten
- **WHEN** a client requests any path under `https://console.fabrick.me/admin/<...>`
- **THEN** the console Static Web App rewrites the request to `/admin/index.html`
- **AND** the request is not absorbed by the console SPA's navigation fallback

### Requirement: Release pipeline builds admin in the console deploy job
The `deploy-console` job in `.github/workflows/cd-release.yml` SHALL build the admin SPA and merge its output into the console upload directory before uploading to the Static Web App.

#### Scenario: Admin assets are present in the console deploy upload
- **WHEN** the `deploy-console` job runs for a release
- **THEN** the job installs admin dependencies, runs the admin production build, and copies `applications/admin/dist` into `applications/console/dist/admin`
- **AND** the `Azure/static-web-apps-deploy@v1` step uploads the merged `applications/console/dist` as a single payload

#### Scenario: Admin build failure halts the console deploy
- **WHEN** the admin build step fails in `deploy-console`
- **THEN** the job fails before reaching the SWA upload step
- **AND** the console SPA is not redeployed

### Requirement: Admin version tracks the release version
The release version-bump job SHALL update `applications/admin/package.json` to the release version on each release, so that admin's `health.json` reports the same version as the rest of the release.

#### Scenario: Version-bump loop includes admin package.json
- **WHEN** the `version-bump` job runs against `release/vX.Y.Z`
- **THEN** the job sets `applications/admin/package.json` version to `X.Y.Z` alongside api, synthesis, console, landing, cli, and mcp
- **AND** the admin `package.json` is included in the commit pushed back to the release branch

#### Scenario: Admin health.json reports release version
- **WHEN** the admin build runs during `deploy-console` for `release/vX.Y.Z`
- **THEN** the produced `applications/admin/dist/health.json` contains `{"version":"X.Y.Z"}`
- **AND** that file is served at `https://console.fabrick.me/admin/health.json` after deploy

### Requirement: Admin is publicly accessible
The admin SPA SHALL be reachable without authentication, matching the access model of the console and landing SPAs.

#### Scenario: Unauthenticated request succeeds
- **WHEN** an anonymous client requests `https://console.fabrick.me/admin/`
- **THEN** the Static Web App returns the admin `index.html` with HTTP 200
- **AND** no login redirect is issued
