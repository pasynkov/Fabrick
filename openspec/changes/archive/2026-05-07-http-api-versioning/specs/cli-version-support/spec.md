# CLI Version Support Specification

## Overview
Update the Fabrick CLI to support versioned API endpoints, ensuring compatibility with the new `/v1` API structure.

## Requirements

### Functional Requirements
- All API calls must use `/v1` prefix except health checks
- Error handling for unsupported API versions

### Non-Functional Requirements
- No breaking changes to CLI command interface
- Seamless user experience with versioned backend
- Clear error messages for version-related issues
- Performance impact should be negligible

## Implementation Details

### API Service Updates
```typescript
// api.service.ts modifications
export class ApiService {
  async request<T>(
    apiUrl: string,
    path: string,
    token: string | null,
    options: RequestInit = {},
  ): Promise<T> {
    // Add version prefix to path unless it's health endpoint
    const versionedPath = path.startsWith('/health') 
      ? path 
      : `/v1${path}`;
    
    const base = apiUrl.trim().replace(/\/$/, '');
    const url = `${base}${versionedPath}`;
    // ... rest of implementation
  }
}
```

### Command Updates
No changes required to command interfaces - version handling is transparent at the API service level.

## Endpoint Mapping

### Authentication Endpoints
| Command | Current Path | New Path |
|---------|--------------|----------|
| `fabrick login` | `/auth/login` | `/v1/auth/login` |
| CLI token generation | `/auth/cli-token` | `/v1/auth/cli-token` |
| Token refresh | `/auth/refresh` | `/v1/auth/refresh` |

### Project Operations
| Command | Current Path | New Path |
|---------|--------------|----------|
| `fabrick push` | `/projects/:id/context` | `/v1/projects/:id/context` |
| Project listing | `/orgs/:id/projects` | `/v1/orgs/:id/projects` |
| Synthesis trigger | `/projects/:id/synthesis` | `/v1/projects/:id/synthesis` |

### Health Checks
| Operation | Path | Notes |
|-----------|------|-------|
| Service health | `/health` | Remains unversioned |

## Error Handling

### Version Compatibility
- Detect and report API version mismatches
- Graceful fallback for version-related errors
- Clear error messages for unsupported versions

### Health Check Handling
- Ensure health checks continue to work for service discovery
- Version-independent health status reporting

## Testing Requirements

### Unit Tests
- Mock API service with versioned endpoints
- Test version configuration parsing
- Verify health endpoint remains unversioned

### Integration Tests
- Test CLI commands with versioned API
- Verify authentication flows work correctly
- Test error handling for invalid versions

### E2E Tests
- Full CLI workflow with versioned backend
- Test all major CLI operations (init, login, push)
- Verify configuration options work correctly

## Documentation Updates

### CLI Help Text
- Update any hardcoded API endpoint references
- Ensure help text reflects versioned API usage

### README and Guides
- Update API endpoint examples

## Security Considerations

### Token Handling
- Ensure authentication tokens work with versioned endpoints
- Verify refresh token flows function correctly
- Test API key authentication with versioned paths

### Error Information
- Avoid exposing sensitive version information in error messages
- Maintain secure error handling practices