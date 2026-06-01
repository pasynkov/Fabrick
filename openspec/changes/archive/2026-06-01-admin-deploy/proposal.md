## Why

The admin SPA (`applications/admin`) was implemented but never wired into the release pipeline. Its vite config already sets `base: '/admin/'`, emits `health.json`, and the console SWA's `staticwebapp.config.json` already routes `/admin/*` → `/admin/index.html` — yet the release workflow never builds admin or copies its assets into the console deploy, so `console.fabrick.me/admin/` returns 404 in production.

## What Changes

- Bundle admin build output into the console Static Web App deploy at `/admin/` subpath, on lockstep with each release.
- Add `applications/admin/package.json` to the release version-bump loop so admin's `package.json` version tracks the release tag.
- Extend post-deploy version validation to assert `console.fabrick.me/admin/health.json` matches the release version.

## Capabilities

### New Capabilities
- `admin-deploy`: How the admin SPA is built and served as a subpath of the console Static Web App during a release.

### Modified Capabilities
- `post-deploy-version-validation`: Adds an admin version check alongside the existing api/console/landing checks.

## Impact

- `.github/workflows/cd-release.yml`:
  - `version-bump` job — admin's `package.json` joins the bump loop and the staged `git add`.
  - `deploy-console` job — installs and builds admin, copies `applications/admin/dist` into `applications/console/dist/admin`, then uploads the merged directory as the SWA payload.
  - `validate-versions` job — adds `check_version "admin" "https://console.fabrick.me/admin/health.json" "version"`.
- `applications/admin/package.json` — version field will be advanced by release tooling (no manual edit).
- No Azure infrastructure changes (existing console SWA, no new domain, no auth gate).
- No edits to `applications/console/public/staticwebapp.config.json` (rewrite rules for `/admin/*` already in place).
- No changes to `ci-unit.yml` (admin has no test suite yet — parity with console/landing).
