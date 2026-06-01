## Context

The repo has three frontend SPAs: `landing`, `console`, `admin`. Landing and console each have their own Azure Static Web App and are deployed by dedicated jobs in `.github/workflows/cd-release.yml`. Admin was authored to live as a subpath of console — its vite config declares `base: '/admin/'`, it emits the same `health.json` artifact as the other SPAs, and `applications/console/public/staticwebapp.config.json` already declares rewrite rules for `/admin/*` and excludes `/admin/*` from the SPA navigation fallback. Despite that wiring, no CI job actually builds admin or merges its output into the console deploy, so the admin route is dead in production.

The first Azure deploy (April 2026) surfaced lessons captured in `project_azure_deploy_lessons.md` about packaging the API and synthesis services. Frontend deploys via SWA are simpler — they take a built directory and an action token — and have not exhibited similar pitfalls. The constraint here is to extend the existing `deploy-console` job without disturbing its current behavior or introducing new Azure resources.

Lockstep with the console release is an explicit project choice: a single release branch advances all SPA versions together; there is no requirement for admin to ship independently.

## Goals / Non-Goals

**Goals:**
- Serve admin at `https://console.fabrick.me/admin/` after every release.
- Keep admin's `package.json` version in sync with the release tag.
- Verify the deployed admin reports the expected version via `/admin/health.json`.
- Reuse the existing console SWA, custom domain, and SPA routing configuration.

**Non-Goals:**
- No separate `admin.fabrick.me` domain or its own SWA.
- No authentication/authorization on admin routes (public read-only access matches the current admin SPA scope).
- No CI changes for unit tests or linting (admin has no test suite; parity with the other SPAs).
- No edits to `applications/console/public/staticwebapp.config.json` (already correct for the subpath setup).
- No Terraform changes.

## Decisions

### Decision: Subpath of console SWA, not a separate SWA
The admin assets are merged into the console SWA's upload directory, so a single Static Web App serves both UIs.

**Why over a dedicated SWA:**
- Zero new Azure resources, no new DNS, no new SWA token to manage.
- Console's existing `staticwebapp.config.json` already encodes the subpath rewrites; this is the path it was designed for.
- Free SWA tier remains sufficient.

**Trade-off:** Admin cannot be released independently of console. Accepted — lockstep is the chosen release model.

### Decision: Build and merge inside the existing `deploy-console` job
Admin is built in the same job that builds console, and its `dist/` is copied into `applications/console/dist/admin/` before the `Azure/static-web-apps-deploy@v1` step runs.

**Why over a separate `deploy-admin` job that uploads to the same SWA:**
- A single SWA upload is atomic; two uploads to the same SWA from different jobs would race and could overwrite each other's payload.
- The console job already checks out the repo and has Node 24 set up; adding two `npm ci` + `npm run build` steps is cheap.
- Failures in either build correctly fail the deploy as a unit.

### Decision: Add admin to the release version-bump loop
The `version-bump` job's loop already iterates over the apps that share the release version. Admin joins that loop, and its `package.json` is added to the `git add` set.

**Why:** Admin's vite `healthJsonPlugin` reads `package.json` version at build time and emits it into `health.json`. Without the bump, `/admin/health.json` would always report `0.11.0` (its current value), and `validate-versions` would never match.

### Decision: Validate `/admin/health.json` post-deploy
`validate-versions` gets a new `check_version "admin" "https://console.fabrick.me/admin/health.json" "version"` call, mirroring the existing console/landing checks.

**Why:** Same SWA, but a separate URL: this catches the specific failure mode where the console upload succeeds but the admin subdirectory was omitted or stale.

### Decision: No `VITE_API_URL` for admin (yet)
Console is built with `VITE_API_URL=https://api.fabrick.me`. Admin currently has no API calls; this env var is not added until admin needs it. Parity is not a strong enough reason to introduce dead config.

## Risks / Trade-offs

- **Admin build failure breaks console deploy.** Mitigation: by design — lockstep was chosen, and a broken admin build should block the release.
- **Stale admin assets if a contributor edits `deploy-console` and accidentally drops the merge step.** Mitigation: `validate-versions` will fail on `/admin/health.json` mismatch, surfacing the regression before the release is finalized.
- **Two `npm ci` runs in one job increase wall time by ~30–60s.** Mitigation: acceptable; release frequency is low. If it ever matters, both apps could share the root install.
- **No auth.** The admin UI is reachable by anyone who knows the URL. Mitigation: explicit project decision; revisit when the admin gains write actions or sensitive data.

## Migration Plan

1. Merge this change to `develop`. CI runs `ci-unit.yml` unaffected.
2. Cut the next `release/vX.Y.Z` branch as usual. The augmented `version-bump` job advances all six package.json files (api, synthesis, console, landing, cli, mcp) plus admin.
3. `deploy-console` builds both SPAs and uploads the merged tree. No rollback step needed beyond the existing console rollback (re-run the previous release tag).
4. `validate-versions` now reports four frontend health checks (console, landing, admin, plus api).

No data migration. No production state outside the SWA upload itself.
