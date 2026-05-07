# Console Version Support Specification

## Overview
Update the Fabrick Console React application to support versioned API endpoints, ensuring compatibility with the new `/v1` API structure.

## Requirements

### Functional Requirements
- All API calls must use `/v1` prefix for versioned endpoints
- Maintain existing authentication and token refresh flows
- Update all API endpoint references in the codebase
- Preserve existing user interface and functionality

### Non-Functional Requirements
- No changes to user interface or user experience
- Maintain current authentication and session management
- No performance impact from versioned endpoints
- Backward compatibility not required (coordinated deployment)

## Implementation Details

### API Client Updates
```typescript
// api.ts modifications
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_VERSION = 'v1'; // Hardcoded for initial implementation

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let token = getToken();

  // Add version prefix unless it's a health check
  const versionedPath = path.startsWith('/health') 
    ? path 
    : `/v${API_VERSION}${path}`;

  // ... existing token refresh logic

  const res = await fetch(`${API_URL}${versionedPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // ... rest of implementation
}
```

### Endpoint Updates

#### Authentication Endpoints
```typescript
export const api = {
  register: (email: string, password: string, persistent?: boolean) =>
    request<{ access_token: string; refresh_token?: string; user: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, persistent }),
    }),
  // All auth endpoints automatically get /v1 prefix via request function
}
```

#### Organization Management
```typescript
orgs: {
  list: () => request<{ id: string; name: string; slug: string; role: string }[]>('/orgs'),
  create: (name: string) =>
    request<{ id: string; name: string; slug: string }>('/orgs', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  // All org endpoints automatically get /v1 prefix
}
```

#### Project Management
```typescript
projects: {
  list: (orgId: string) =>
    request<{ id: string; name: string; slug: string; autoSynthesisEnabled?: boolean }[]>(`/orgs/${orgId}/projects`),
  // All project endpoints automatically get /v1 prefix
}
```

## Token Refresh Compatibility

### Refresh Token Flow
```typescript
// tokenRefresh.ts - ensure compatibility with versioned endpoints
export async function doRefresh(refreshToken: string): Promise<TokenResponse> {
  // Must use /v1/auth/refresh - update to include version prefix
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  // ... implementation
}
```

### Session Management
- Existing session management logic remains unchanged
- Token storage and retrieval functions work identically
- Authentication state management preserved

## Environment Configuration

### Build Configuration
```typescript
// No new environment variables needed
// Existing VITE_API_URL continues to work
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_VERSION = 'v1'; // Hardcoded initially
```

### Future Configurability
```typescript
// Future enhancement for configurable version
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
```

## Component Updates

### No UI Changes Required
- All React components remain unchanged
- API interactions happen through the api.ts module
- Existing prop interfaces and component contracts preserved

### Error Handling
- Existing error handling logic works with versioned endpoints
- Error messages and user feedback remain consistent
- Token refresh error handling preserved

## Testing Requirements

### Unit Tests
- Update API mocks to use versioned endpoints
- Test version prefix application logic
- Verify health endpoint remains unversioned

### Integration Tests
- Test full user authentication flows
- Verify all CRUD operations work with versioned APIs
- Test token refresh scenarios

### E2E Tests
- Complete user journey testing with versioned backend
- Login, organization management, project operations
- Verify error handling and edge cases

## Build and Deployment

### Build Process
- No changes to Vite configuration required
- Existing build pipeline works unchanged
- Environment variable handling preserved

### Deployment Coordination
- Console deployment must be coordinated with backend API versioning
- No graceful degradation possible without backend compatibility
- Consider deployment order (API first, then console)

## Error Handling

### API Version Errors
```typescript
// Enhanced error handling for version-related issues
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 404 && body.message?.includes('version')) {
    throw Object.assign(new Error('API version not supported'), { status: res.status });
  }
  throw Object.assign(new Error(body.message || res.statusText), { status: res.status });
}
```

### User Feedback
- Clear error messages for version compatibility issues
- Graceful handling of API upgrade scenarios
- Maintain existing error UI components

## Security Considerations

### Authentication Security
- Ensure JWT token validation works with versioned endpoints
- Verify CORS settings accommodate versioned API paths
- Maintain existing security headers and practices

### Token Management
- Existing secure token storage practices preserved
- Refresh token security maintained with versioned endpoints
- Session timeout and security policies unchanged

## Documentation Updates

### Developer Documentation
- Update API endpoint examples in comments
- Document version handling approach
- Update any hardcoded endpoint references

### User Documentation
- No user-facing documentation changes needed
- Internal developer guides updated for version handling
- API integration examples updated