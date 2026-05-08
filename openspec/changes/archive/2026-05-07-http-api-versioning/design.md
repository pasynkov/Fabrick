# HTTP API Versioning Design

## Overview

Implement URI-based API versioning using NestJS built-in versioning capabilities to support future API evolution while maintaining client compatibility.

## Technical Approach

### NestJS Versioning Strategy

Use NestJS URI versioning with the following configuration:

```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

### Controller Versioning

Apply versioning decorators to controllers and specific endpoints:

```typescript
// Example controller
@Controller('auth')
@Version('1')
export class AuthController {
  // All endpoints automatically get /v1 prefix
}

// Health controller remains unversioned
@Controller('health')
export class HealthController {
  // No version decorator - stays at /health
}
```

### Version Configuration

- **Default Version**: v1 for all existing functionality
- **Versioning Type**: URI-based (`/v1/endpoint`)
- **Unversioned Endpoints**: `/health` only
- **Future Versions**: v2, v3, etc. can be added incrementally

## API Structure Changes

### Before (Current)
```
/auth/login
/auth/register
/orgs
/orgs/:id/projects
/projects/:id/repos
/projects/:id/synthesis
/health
```

### After (With Versioning)
```
/v1/auth/login
/v1/auth/register
/v1/orgs
/v1/orgs/:id/projects
/v1/projects/:id/repos
/v1/projects/:id/synthesis
/health (unchanged)
```

## Client Updates

### CLI (api.service.ts)
- Update base URL construction to include version prefix
- Add version configuration option
- Maintain backward compatibility through configuration

### Console (api.ts)
- Update all API endpoint calls to include `/v1` prefix
- Ensure token refresh flows work with versioned endpoints

### MCP (api-client.ts)
- Update synthesis file endpoint to use versioned URL
- Add version parameter to API client functions

## Implementation Strategy

### Phase 1: Backend API Versioning
1. Enable NestJS versioning in main.ts
2. Add `@Version('1')` decorators to all controllers except health
3. Update any internal API calls to use versioned endpoints
4. Update tests to use versioned endpoints

### Phase 2: Client Updates
1. Update CLI to use `/v1` prefix for all API calls
2. Update Console frontend to use versioned endpoints
3. Update MCP server to use versioned endpoints
4. Update any integration tests

### Phase 3: Validation & Testing
1. Ensure `/health` endpoint remains unversioned
2. Verify all versioned endpoints work correctly
3. Run full test suite to validate changes
4. Test client-server integration

## Configuration Management

### Environment Configuration
- No environment-specific changes needed
- Version is hardcoded as default in NestJS config
- Future versions can be enabled/disabled via feature flags

### Client Configuration
- CLI: Version hardcoded to v1
- Console: Version hardcoded to v1
- MCP: Version hardcoded to v1

## Error Handling

### Invalid Version Requests
- NestJS automatically returns 404 for unsupported versions
- Clear error messages for version mismatch scenarios

### Health Check Compatibility
- `/health` endpoint must remain unversioned for load balancer compatibility
- Infrastructure monitoring tools expect unversioned health endpoint

## Migration Strategy

### No Data Migration Required
- Only endpoint URLs change, no data structure changes
- All existing data remains compatible

### Client Migration
- All clients must be updated simultaneously with backend deployment
- No gradual migration possible since no backward compatibility layer

### Deployment Coordination
- Backend and client deployments must be coordinated
- Consider feature flag to enable versioning gradually if needed

## Future Considerations

### Multi-Version Support
- Framework ready for v2, v3 endpoints alongside v1
- Controllers can specify multiple supported versions
- Gradual deprecation strategy for old versions

### Version Discovery
- Consider adding version metadata to API responses
- OpenAPI/Swagger documentation per version
- Version compatibility matrix for clients