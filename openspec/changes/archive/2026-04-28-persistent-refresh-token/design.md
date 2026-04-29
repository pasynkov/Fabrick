# Persistent Refresh Token Design

## Overview

Implement a conditional persistent login feature that allows users to choose between session-based authentication (current behavior) and persistent authentication using secure httpOnly cookies for refresh token storage.

## Technical Design

### Frontend Changes

#### 1. Login/Register Form Enhancement
- Add a "Save Login" checkbox to both login and register forms
- Checkbox is unchecked by default to maintain current behavior
- Checkbox state is passed to authentication API calls

#### 2. Authentication Context Updates
- Modify `setAuth` function to accept an optional `persistent` parameter
- Update token storage logic to use either sessionStorage or prepare for cookie-based storage
- Add logic to check for persistent tokens on application startup

#### 3. Token Storage Strategy
- **Session Storage (default)**: Continue using sessionStorage for access and refresh tokens
- **Persistent Storage**: Use httpOnly cookies for refresh tokens, sessionStorage for access tokens
- Access tokens remain in sessionStorage in both cases for JavaScript access

### Backend Changes

#### 1. Authentication Endpoints
- Modify `/auth/login` and `/auth/register` to accept optional `persistent` parameter
- When `persistent=true`, return refresh token in response body for frontend to store
- When `persistent=false` or omitted, do not issue refresh token at all
- Backend does NOT set cookies — frontend manages all cookie storage

#### 2. Token Refresh Endpoint
- `/auth/refresh` accepts refresh token from request body only
- Returns new access token and new refresh token in response body
- Frontend is responsible for reading the cookie and sending token in request body

### Security Considerations

#### Frontend-Managed Cookies
- Frontend uses `document.cookie` to store/read/clear refresh tokens
- Cookies set with `Secure` and `SameSite=Strict` flags (but NOT httpOnly, since frontend must read them)
- `Secure` flag ensures transmission only over HTTPS in production
- `SameSite=Strict` prevents CSRF by blocking cross-site requests

#### Token Rotation
- Continue existing refresh token rotation for both storage methods
- When using cookies, update the cookie with new refresh token

#### Logout Handling
- Clear both sessionStorage and cookies on logout
- Revoke refresh tokens on server side

## Implementation Flow

### User Login Flow (Persistent)
1. User checks "Save Login" checkbox and submits login form
2. Frontend sends login request with `persistent: true` parameter
3. Backend validates credentials and issues tokens
4. Backend returns access token, refresh token, and user data in response body
5. Frontend stores access token in sessionStorage
6. Frontend stores refresh token in cookie via `document.cookie` with `Secure; SameSite=Strict`
7. Frontend updates auth context with user data

### Application Startup Flow
1. Check sessionStorage for existing access token and user data
2. If found and not expired, use current session
3. If not found or expired, check for refresh token cookie via `document.cookie`
4. If refresh token cookie exists, send it in request body to `/auth/refresh`
5. If refresh successful, store new access token in sessionStorage, update cookie with new refresh token
6. If refresh fails or no cookie, redirect to login

### User Login Flow (Session)
1. User leaves "Save Login" unchecked (default) and submits login form
2. Frontend sends login request without `persistent` parameter
3. Backend validates credentials and issues tokens
4. Backend returns both access and refresh tokens in response body
5. Frontend stores both tokens in sessionStorage (current behavior)

## Migration Strategy

### Phase 1: Backend Support
- Add optional `persistent` parameter support to auth endpoints
- Implement cookie-based refresh token handling
- Maintain backward compatibility with existing clients

### Phase 2: Frontend Implementation
- Add "Save Login" checkbox to forms
- Update authentication context and storage logic
- Implement startup token detection

### Phase 3: Testing & Rollout
- Test both persistent and session modes
- Verify token rotation and logout flows
- Deploy with feature flag if needed

## API Changes

### POST /auth/login
```typescript
// Request
{
  email: string;
  password: string;
  persistent?: boolean; // New optional field
}

// Response (persistent=true)
{
  access_token: string;
  refresh_token: string; // Frontend stores in cookie via document.cookie
  user: { id: string; email: string; };
}

// Response (persistent=false or omitted)
{
  access_token: string;
  // No refresh_token — session only, no persistence
  user: { id: string; email: string; };
}
```

### POST /auth/register
Same changes as login endpoint.

### POST /auth/refresh
```typescript
// Request (always via body — frontend reads cookie and sends token)
{
  refresh_token: string;
}

// Response
{
  access_token: string;
  refresh_token: string; // Frontend updates cookie with new value
}
```

## Configuration

### Environment Variables
- `REFRESH_TOKEN_SECRET`: Existing refresh token secret (unchanged)

### Frontend Configuration
- No additional configuration required
- Cookie storage managed entirely by frontend via `document.cookie`