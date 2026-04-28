# Persistent Refresh Token Storage

## Overview

Implements secure httpOnly cookie storage for refresh tokens when users choose persistent login, providing long-term authentication without compromising security.

## Requirements

### Functional Requirements

#### Cookie-Based Storage
- Store refresh tokens in httpOnly cookies when `persistent=true`
- Set appropriate cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`
- Use same domain as application for cookie scope
- Set cookie expiration to match refresh token expiration (7 days)

#### Storage Detection
- Detect existing refresh tokens from cookies on server startup
- Support reading refresh tokens from both cookies and request body
- Prioritize request body over cookies for backward compatibility

#### Token Rotation
- Update refresh token cookie during token refresh operations
- Maintain same storage method (cookie) for rotated tokens
- Clear cookies on token revocation/logout

### Security Requirements

#### Cookie Security
- Use `HttpOnly` flag to prevent JavaScript access
- Use `Secure` flag in production (HTTPS)
- Use `SameSite=Strict` to prevent CSRF attacks
- Set appropriate `Domain` and `Path` attributes

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
  refresh_token?: string; // Only present when persistent=false
  user: {
    id: string;
    email: string;
  };
}
```

When `persistent=true`:
- Response omits `refresh_token` field
- Sets `Set-Cookie` header: `refresh_token={token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`

#### Token Refresh Endpoint

```typescript
// POST /auth/refresh
interface RefreshRequest {
  refresh_token?: string; // Optional - falls back to cookie
}

interface RefreshResponse {
  access_token: string;
  refresh_token?: string; // Only present when not using cookies
}
```

Priority for refresh token source:
1. Request body `refresh_token` field
2. `refresh_token` cookie

## Implementation

### Backend Changes

#### Auth Service Methods
```typescript
// In auth.service.ts
async login(email: string, password: string, persistent?: boolean) {
  // ... existing validation logic
  
  const access_token = this.signJwt(user);
  const refresh_token = this.signRefreshJwt(user);
  
  return {
    access_token,
    refresh_token: persistent ? undefined : refresh_token,
    user: { id: user.id, email: user.email },
    // For controller to set cookie
    refreshTokenForCookie: persistent ? refresh_token : undefined,
  };
}

async refresh(refreshToken: string) {
  // ... existing refresh logic
  // Return both tokens for flexible response handling
}
```

#### Controller Updates
```typescript
// In auth.controller.ts
@Post('login')
async login(
  @Body() { email, password, persistent }: LoginDto,
  @Res({ passthrough: true }) response: Response,
) {
  const result = await this.authService.login(email, password, persistent);
  
  if (result.refreshTokenForCookie) {
    response.cookie('refresh_token', result.refreshTokenForCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
  }
  
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    user: result.user,
  };
}

@Post('refresh')
async refresh(
  @Body() body: RefreshDto,
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
) {
  const refreshToken = body.refresh_token || request.cookies?.refresh_token;
  
  if (!refreshToken) {
    throw new UnauthorizedException('No refresh token provided');
  }
  
  const result = await this.authService.refresh(refreshToken);
  
  // If original token was from cookie, update cookie
  if (!body.refresh_token && request.cookies?.refresh_token) {
    response.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    return {
      access_token: result.access_token,
      // Don't return refresh_token in body when using cookies
    };
  }
  
  return result;
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
- **HttpOnly**: `true`
- **Secure**: `true` (production), `false` (development)
- **SameSite**: `Strict`
- **Max-Age**: `604800` (7 days in seconds)
- **Domain**: Auto-detect or configured
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