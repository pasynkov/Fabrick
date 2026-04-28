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
- When `persistent=true`, set refresh token as secure httpOnly cookie
- When `persistent=false` or omitted, return refresh token in response body (current behavior)

#### 2. Cookie Configuration
- Set refresh token as httpOnly, secure, sameSite cookie
- Use appropriate domain and path settings for the application
- Set cookie expiration to match refresh token expiration (7 days)

#### 3. Token Refresh Endpoint
- Update `/auth/refresh` to accept refresh tokens from both cookies and request body
- Priority: Check request body first, then fall back to cookies
- Return new refresh token using the same method (cookie if original was cookie)

### Security Considerations

#### httpOnly Cookies
- Prevents XSS attacks from accessing refresh tokens
- Automatically included in requests to the same domain
- Secure flag ensures transmission only over HTTPS in production

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
4. Backend sets refresh token as httpOnly cookie
5. Backend returns access token and user data in response body
6. Frontend stores access token in sessionStorage
7. Frontend updates auth context with user data

### Application Startup Flow
1. Check sessionStorage for existing access token and user data
2. If found and not expired, use current session
3. If not found or expired, check for refresh token cookie
4. If refresh token cookie exists, attempt token refresh
5. If refresh successful, update sessionStorage with new access token
6. If refresh fails, redirect to login

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
  user: { id: string; email: string; };
}
// + Set-Cookie: refresh_token=xxx; HttpOnly; Secure; SameSite=Strict

// Response (persistent=false or omitted)
{
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; };
}
```

### POST /auth/register
Same changes as login endpoint.

### POST /auth/refresh
```typescript
// Request (body takes priority)
{
  refresh_token?: string; // Optional, falls back to cookie
}

// Alternative: Cookie-based refresh
// Cookie: refresh_token=xxx

// Response
{
  access_token: string;
  refresh_token?: string; // Only in body if original was in body
}
// + Optional Set-Cookie for new refresh token if using cookies
```

## Configuration

### Environment Variables
- `REFRESH_TOKEN_SECRET`: Existing refresh token secret
- `COOKIE_DOMAIN`: Domain for refresh token cookies (default: auto-detect)
- `COOKIE_SECURE`: Force secure cookies (default: true in production)

### Frontend Configuration
- No additional configuration required
- Behavior determined by user choice and server response