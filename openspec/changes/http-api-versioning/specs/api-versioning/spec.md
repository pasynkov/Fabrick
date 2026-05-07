# API Versioning Specification

## Overview
Implement NestJS URI-based API versioning to support future API evolution while maintaining backward compatibility.

## Requirements

### Functional Requirements
- All API endpoints must be versioned with `/v1` prefix except `/health`
- Health endpoint must remain unversioned for infrastructure compatibility
- Default version must be v1 for all existing functionality
- Version parsing and routing handled by NestJS framework
- Support for multiple versions in the future (v2, v3, etc.)

### Non-Functional Requirements
- No performance impact on API response times
- Backward compatibility not required (initial versioning implementation)
- Must work with existing authentication and authorization mechanisms
- Support for OpenAPI/Swagger documentation per version

## Implementation Details

### NestJS Configuration
```typescript
// main.ts additions
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

### Controller Updates
```typescript
// All controllers except health get version decorator
@Controller('auth')
@Version('1')
export class AuthController {
  // Endpoints automatically prefixed with /v1
}

// Health controller stays unversioned
@Controller('health')
export class HealthController {
  // No @Version decorator - endpoint stays at /health
}
```

### Endpoint Mapping
| Current Endpoint | Versioned Endpoint | Notes |
|-----------------|-------------------|--------|
| `/auth/login` | `/v1/auth/login` | Standard versioning |
| `/auth/register` | `/v1/auth/register` | Standard versioning |
| `/orgs` | `/v1/orgs` | Standard versioning |
| `/orgs/:id/projects` | `/v1/orgs/:id/projects` | Standard versioning |
| `/projects/:id/repos` | `/v1/projects/:id/repos` | Standard versioning |
| `/projects/:id/synthesis` | `/v1/projects/:id/synthesis` | Standard versioning |
| `/health` | `/health` | Remains unversioned |

## Testing Requirements

### Unit Tests
- Verify version decorators applied correctly to controllers
- Test version routing with valid and invalid versions
- Ensure health endpoint remains unversioned

### Integration Tests
- Test all versioned endpoints respond correctly
- Verify authentication works with versioned endpoints
- Confirm health endpoint accessible without version prefix
- Test invalid version requests return 404

### E2E Tests
- Full API workflow testing with versioned endpoints
- Client authentication and authorization flows
- Health check monitoring compatibility

## Error Handling

### Invalid Version
- HTTP 404 for unsupported API versions
- Clear error message indicating supported versions

### Version Mismatch
- Graceful handling of client-server version mismatches
- Informative error responses for debugging

## Documentation

### OpenAPI/Swagger
- Generate versioned API documentation
- Clear indication of supported versions
- Migration guides for future versions

### Client Documentation
- Update API documentation with versioned endpoints
- Provide migration guide for existing clients
- Version compatibility matrix

## Deployment Considerations

### Rollout Strategy
- Coordinate backend and client deployments
- No gradual rollout possible without backward compatibility
- Consider feature flag for emergency rollback

### Monitoring
- Monitor health endpoint continues to work unversioned
- Track API usage by version
- Alert on version-related errors

## Security Considerations

### Authentication
- Ensure JWT and refresh token flows work with versioned endpoints
- Verify API key validation works across versions

### Authorization
- Confirm role-based access control works with versioned endpoints
- Test admin guards and permissions with new routing