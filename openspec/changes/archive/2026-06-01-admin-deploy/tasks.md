## 1. Wire admin into release version-bump

- [x] 1.1 In `.github/workflows/cd-release.yml` `version-bump` job, add `applications/admin` to the bump loop so admin's `package.json` version is set to the release version alongside api, synthesis, console, landing, cli, mcp.
- [x] 1.2 In the same job, add `applications/admin/package.json` to the `git add` list before the commit step.

## 2. Build and merge admin in deploy-console

- [x] 2.1 In `.github/workflows/cd-release.yml` `deploy-console` job, after the existing console `npm ci` + `npm run build`, add steps that `npm ci` and `npm run build` in `applications/admin` (use `actions/setup-node`'s npm cache for `applications/admin/package-lock.json`).
- [x] 2.2 Add a step that copies the built admin tree into the console upload directory: `cp -r applications/admin/dist applications/console/dist/admin` (run before the `Azure/static-web-apps-deploy@v1` step).
- [x] 2.3 Confirm the existing `Azure/static-web-apps-deploy@v1` step still points at `applications/console/dist` (merged payload) — no change needed beyond verifying.

## 3. Post-deploy validation

- [x] 3.1 In `.github/workflows/cd-release.yml` `validate-versions` job, add `check_version "admin" "https://console.fabrick.me/admin/health.json" "version" || failed=1` alongside the existing console and landing checks.

## 4. Verify

- [ ] 4.1 Open a PR with the workflow changes; ensure `ci-unit.yml` is unchanged and stays green.
- [ ] 4.2 After merge, cut a test release branch and confirm: admin's `package.json` version is bumped in the version-bump commit; the SWA payload contains `admin/index.html`, `admin/assets/*`, and `admin/health.json`; `https://console.fabrick.me/admin/` loads and `https://console.fabrick.me/admin/health.json` returns the release version.
- [ ] 4.3 Confirm `validate-versions` reports `admin: ok` in the run log.
