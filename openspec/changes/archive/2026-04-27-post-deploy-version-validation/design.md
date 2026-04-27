## Context

Currently, deployments are completed but there's no automated verification that the correct versions are running. The cd-release.yml workflow extracts version from release branch, bumps all package.json files, and deploys services in parallel to Azure (API as Azure Functions, Console/Landing as Azure Static Web Apps). Without post-deployment validation, version mismatches go undetected.

The proposed solution adds version endpoints/files and a validation step that runs after all deployments complete, checking each service reports the expected version.

## Goals / Non-Goals

**Goals:**
- Verify API, Console, and Landing services deployed with correct version
- Fail CI/CD pipeline with clear error if any version mismatches occur
- Provide runtime version information for API and frontend applications
- Support dynamic version reading (not hardcoded)

**Non-Goals:**
- Add validation for Synthesis, MCP, or CLI services (excluded per requirements)
- Support multiple environments/promotion flows
- Add version history or rollback capabilities
- Modify deployment infrastructure itself

## Decisions

1. **API Version Endpoint**: Modify existing `/health` controller to read package.json dynamically and return `{ status: 'ok', 'app-version': '<version>' }`
   - Rationale: Reuses existing health check infrastructure, single source of truth (package.json)
   - Alternative: Store version in environment variable - more complex, requires deployment step

2. **Frontend Version File**: Generate `/health.json` in static assets during Vite build, not runtime
   - Rationale: Frontends are static, no runtime to read package.json; version is known at build time
   - Alternative: Create version at deployment time - unnecessary complexity, Vite build is cleaner

3. **Validation Implementation**: Standalone GitHub Actions job in cd-release.yml that runs after deployment jobs complete
   - Rationale: Clear separation of concerns, easy to understand and modify
   - Uses curl/wget to check endpoints, compares against extracted version from release branch

4. **Version Source for Validation**: Extract version from release branch reference (as currently done), compare all apps against same version
   - Rationale: Consistent with existing pipeline logic, single source of truth

## Risks / Trade-offs

- [Risk: Package.json not available in Azure Functions] → Mitigate: Verify package.json is included in Functions deployment package; if not, use environment variable as fallback
- [Risk: Static Web Apps /health.json not served] → Mitigate: Test that JSON files are served with correct MIME type; configure staticwebapp.config.json if needed
- [Trade-off: Validation adds ~30-60 seconds to pipeline] → Acceptable: Outweighed by safety gain
- [Risk: Network latency in validation checks] → Mitigate: Add retries to curl requests (3 attempts with backoff)

## Migration Plan

1. Deploy API changes (health controller modification)
2. Deploy frontend build changes (health.json generation)
3. Add validation job to cd-release.yml
4. Test in staging/release pipeline before production use
5. Monitor first few deployments for any validation failures

Rollback strategy: If validation step causes issues, remove validation job from cd-release.yml (previous version endpoints work independently).
