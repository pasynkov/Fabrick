# Persistent Refresh Token Storage

## Overview

Implements secure httpOnly cookie storage for refresh tokens when users choose persistent login, providing long-term authentication without compromising security.

## Requirements

### Functional Requirements

#### Frontend-Managed Cookie Storage
- Backend returns refresh token in response body when `persistent=true`
- Frontend stores refresh token in cookie via `document.cookie` with `Secure; SameSite=Strict` flags
- Cookie is NOT httpOnly — frontend must be able to read and manage it
- Set cookie expiration to match refresh token expiration (7 days)

#### Storage Detection
- On app startup, frontend reads cookie via `document.cookie`
- If cookie found, frontend sends token in request body to `/auth/refresh`
- No cookie reading on the backend

#### Token Rotation
- Update refresh token cookie during token refresh operations
- Maintain same storage method (cookie) for rotated tokens
- Clear cookies on token revocation/logout

### Security Requirements

#### Cookie Security
- Use `Secure` flag in production (HTTPS only)
- Use `SameSite=Strict` to prevent CSRF attacks
- Set appropriate `Path` attribute
- Note: cookies are NOT httpOnly since frontend must read them via `document.cookie`

#### Token Management
- Implement proper token rotation for cookie-stored tokens
- Ensure cookies are cleared on logout
- Validate refresh tokens from cookies same as body tokens

### API Specifications

#### Authentication Endpoints

```typescript
// POST /auth/login
interface LoginRequest {
  email: string;
  password: string;
  persistent?: boolean; // New optional parameter
}

interface LoginResponse {
  access_token: string;
  refresh_token?: string; // Present only when persistent=true
  user: {
    id: string;
    email: string;
  };
}
```

When `persistent=true`:
- Response includes `refresh_token` in body
- Frontend stores it via `document.cookie` with `Secure; SameSite=Strict; Max-Age=604800; Path=/`

When `persistent=false` or omitted:
- Response has no `refresh_token`

#### Token Refresh Endpoint

```typescript
// POST /auth/refresh
interface RefreshRequest {
  refresh_token: string; // Required — frontend reads from cookie and sends in body
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string; // Frontend updates cookie with new value
}
```

## Implementation

### Backend Changes

#### Auth Service Methods
```typescript
// In auth.service.ts
async login(email: string, password: string, persistent?: boolean) {
  // ... existing validation logic
  
  const access_token = this.signJwt(user);
  const refresh_token = persistent ? this.signRefreshJwt(user) : undefined;
  
  return {
    access_token,
    refresh_token, // Only present when persistent=true
    user: { id: user.id, email: user.email },
  };
}

async refresh(refreshToken: string) {
  // ... existing refresh logic
  return {
    access_token: this.signJwt(user),
    refresh_token: this.signRefreshJwt(user),
  };
}
```

#### Controller Updates
```typescript
// In auth.controller.ts — no cookie handling needed
@Post('login')
async login(@Body() { email, password, persistent }: LoginDto) {
  return this.authService.login(email, password, persistent);
}

@Post('refresh')
async refresh(@Body() { refresh_token }: RefreshDto) {
  if (!refresh_token) {
    throw new UnauthorizedException('No refresh token provided');
  }
  return this.authService.refresh(refresh_token);
}
```

### Frontend Cookie Management

```typescript
// Cookie utilities for refresh token management
const REFRESH_COOKIE = 'refresh_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function setRefreshCookie(token: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${REFRESH_COOKIE}=${token}; SameSite=Strict${secure}; Max-Age=${COOKIE_MAX_AGE}; Path=/`;
}

export function getRefreshCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFRESH_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearRefreshCookie() {
  document.cookie = `${REFRESH_COOKIE}=; Max-Age=0; Path=/`;
}
```

### DTOs
```typescript
// auth.dto.ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsBoolean()
  persistent?: boolean;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
```

## Testing

### Unit Tests
- Test cookie setting with `persistent=true`
- Test normal response with `persistent=false`
- Test refresh token reading from cookies
- Test refresh token rotation with cookies
- Test cookie clearing on logout

### Integration Tests
- Test full authentication flow with persistent storage
- Test token refresh flow with cookie-stored tokens
- Test logout and cookie cleanup
- Test mixed storage scenarios

### Security Tests
- Verify httpOnly flag prevents JavaScript access
- Test secure flag behavior in different environments
- Verify SameSite protection against CSRF
- Test token validation from cookies

## Configuration

### Environment Variables
```bash
# Optional - defaults to auto-detection
COOKIE_DOMAIN=.example.com

# Optional - defaults to true in production
COOKIE_SECURE=true
```

### Cookie Configuration
- **Name**: `refresh_token`
- **HttpOnly**: `false` (frontend must read/write via `document.cookie`)
- **Secure**: `true` (production), `false` (development)
- **SameSite**: `Strict`
- **Max-Age**: `604800` (7 days in seconds)
- **Path**: `/` (root path)

## Monitoring

### Metrics
- Track usage of persistent vs session authentication
- Monitor refresh token rotation success rates
- Track cookie-based authentication failures

### Logging
- Log cookie setting/clearing operations
- Log refresh token source (cookie vs body)
- Log authentication method preferences