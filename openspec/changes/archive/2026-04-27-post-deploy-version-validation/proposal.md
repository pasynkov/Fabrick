## Why

Currently, after deploying applications, there's no automated verification that the correct versions are running in production. This creates risk where deployments could silently fail or the wrong version could be running without detection. Adding post-deployment version validation ensures every deployment is verified and the pipeline fails with a clear error message if versions don't match expectations.

## What Changes

- **API Application**: Modify `/health` endpoint to return application version dynamically read from package.json
- **Frontend Applications** (Console, Landing): Generate `/health.json` files during build process containing version information
- **CI/CD Pipeline**: Add validation step in cd-release.yml workflow that checks deployed versions match the release version, fails with clear error message if mismatch detected

## Capabilities

### New Capabilities
- `version-check-api`: API /health endpoint returns version information alongside status
- `version-check-frontend`: Frontend applications expose version via static /health.json file
- `post-deploy-version-validation`: CI/CD validation step that verifies deployed app versions

### Modified Capabilities
<!-- No existing requirements are changing - we're adding new endpoints/files, not changing existing behavior -->

## Impact

- **API**: /health endpoint response structure (adds app-version field)
- **Frontend builds**: New /health.json file generated in static assets
- **CI/CD**: cd-release.yml workflow gains new validation job after deployments
- **Services validated**: API, Console, Landing (Synthesis, MCP, CLI excluded)
- **Deployment safety**: Increased confidence that correct versions are deployed
