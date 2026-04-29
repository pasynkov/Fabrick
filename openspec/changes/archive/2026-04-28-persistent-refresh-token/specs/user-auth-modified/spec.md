# User Auth - Modified for Persistent Login

## Overview

Enhances the existing user authentication capability to support conditional refresh token storage based on user's persistent login preference.

## Modifications to Existing Capability

This specification modifies the existing `user-auth` capability to:

1. Accept optional `persistent` parameter in login and register endpoints
2. Conditionally set refresh tokens as httpOnly cookies when `persistent=true`
3. Support reading refresh tokens from both request body and cookies in refresh endpoint
4. Add logout endpoint to clear httpOnly cookies

## Updated Requirements

### Requirement: Enhanced user registration with persistent option
The system SHALL expose `POST /auth/register` accepting `{ email, password, persistent? }`. When `persistent=true`, it SHALL return the refresh token in the response body for the frontend to store. When `persistent=false` or omitted, no refresh token is issued. The backend does NOT set any cookies.

#### Scenario: Successful registration with persistent login
- **WHEN** a client sends `POST /auth/register` with `persistent: true`
- **THEN** the system returns `{ access_token, refresh_token, user: { id, email } }`

#### Scenario: Successful registration with session login
- **WHEN** a client sends `POST /auth/register` with `persistent: false` or omitted
- **THEN** the system returns `{ access_token, user: { id, email } }` with no refresh token

### Requirement: Enhanced user login with persistent option
The system SHALL expose `POST /auth/login` accepting `{ email, password, persistent? }`. When `persistent=true`, it SHALL return the refresh token in the response body. When `persistent=false` or omitted, no refresh token is issued. The backend does NOT set any cookies.

#### Scenario: Successful login with persistent option
- **WHEN** a client sends `POST /auth/login` with `persistent: true` and correct credentials
- **THEN** the system returns `{ access_token, refresh_token, user: { id, email } }`

#### Scenario: Successful login without persistent option
- **WHEN** a client sends `POST /auth/login` with correct credentials and no persistent flag
- **THEN** the system returns `{ access_token, user: { id, email } }` with no refresh token

### Requirement: Token refresh via request body
The system SHALL expose `POST /auth/refresh` that accepts the refresh token from the request body only. The frontend is responsible for reading the cookie and sending the token. The backend does NOT read cookies.

#### Scenario: Refresh with token in request body
- **WHEN** a client sends `POST /auth/refresh` with `{ refresh_token: "..." }`
- **THEN** the system validates the token, rotates it, and returns `{ access_token, refresh_token }`

#### Scenario: Refresh without token
- **WHEN** a client sends `POST /auth/refresh` with no `refresh_token` in body
- **THEN** the system returns 401 Unauthorized

### Requirement: Logout endpoint
The system SHALL expose `POST /auth/logout` that returns success. Cookie clearing is handled by the frontend via `document.cookie`.

#### Scenario: Logout
- **WHEN** a client sends `POST /auth/logout`
- **THEN** the system returns `{ success: true }` (frontend clears cookie and sessionStorage)

## Implementation Updates

### Enhanced DTOs
```typescript
// auth.dto.ts - Add persistent option
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsBoolean()
  persistent?: boolean;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
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

### Enhanced AuthService
```typescript
// auth.service.ts - Updated methods
export class AuthService {
  async register(email: string, password: string, persistent?: boolean) {
    // ... existing validation logic
    
    const access_token = this.signJwt(user);
    const refresh_token = persistent ? this.signRefreshJwt(user) : undefined;
    
    return {
      access_token,
      refresh_token, // Only present when persistent=true
      user: { id: user.id, email: user.email },
    };
  }

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
    // ... existing refresh logic unchanged
    return {
      access_token: this.signJwt(user),
      refresh_token: this.signRefreshJwt(user),
    };
  }

  async logout() {
    return { success: true };
  }

  // ... existing private methods unchanged
}
```

### Enhanced AuthController
```typescript
// auth.controller.ts - Updated endpoints (no cookie handling needed)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() { email, password, persistent }: RegisterDto) {
    return this.authService.register(email, password, persistent);
  }

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

  @Post('logout')
  async logout() {
    return this.authService.logout();
  }

  // ... existing endpoints (cli-token, etc.) unchanged
}
```

### Module Configuration
No changes needed — cookie parser middleware is NOT required since backend does not handle cookies.

## Testing Updates

### New Test Cases
```typescript
describe('Enhanced AuthService', () => {
  describe('register with persistent option', () => {
    it('returns refresh token for cookie when persistent=true', async () => {
      const result = await service.register('test@example.com', 'password123', true);
      
      expect(result.refresh_token).toBeUndefined();
      expect(result.refreshTokenForCookie).toBeDefined();
      expect(result.isPersistent).toBe(true);
    });

    it('returns refresh token in body when persistent=false', async () => {
      const result = await service.register('test@example.com', 'password123', false);
      
      expect(result.refresh_token).toBeDefined();
      expect(result.refreshTokenForCookie).toBeUndefined();
      expect(result.isPersistent).toBe(false);
    });
  });

  describe('login with persistent option', () => {
    it('handles persistent login correctly', async () => {
      // Similar tests for login
    });
  });

  describe('refresh with dual source', () => {
    it('prioritizes body token over cookie', async () => {
      // Test refresh logic priority
    });
  });
});

describe('Enhanced AuthController', () => {
  describe('POST /auth/register', () => {
    it('sets cookie when persistent=true', async () => {
      const response = {
        cookie: jest.fn(),
      } as any;

      await controller.register(
        { email: 'test@example.com', password: 'password123', persistent: true },
        response
      );

      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false, // In test environment
          sameSite: 'strict',
        })
      );
    });

    it('does not set cookie when persistent=false', async () => {
      const response = {
        cookie: jest.fn(),
      } as any;

      await controller.register(
        { email: 'test@example.com', password: 'password123', persistent: false },
        response
      );

      expect(response.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    it('handles cookie-based refresh', async () => {
      const request = {
        cookies: { refresh_token: 'cookie-token' },
      } as any;

      const response = {
        cookie: jest.fn(),
      } as any;

      const result = await controller.refresh({}, request, response);

      expect(result.refresh_token).toBeUndefined();
      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('clears refresh token cookie', async () => {
      const response = {
        cookie: jest.fn(),
      } as any;

      await controller.logout(response);

      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        '',
        expect.objectContaining({
          maxAge: 0,
        })
      );
    });
  });
});
```

## Security Considerations

### Cookie Security
- All refresh token cookies use `HttpOnly` flag to prevent JavaScript access
- `Secure` flag enforced in production environments
- `SameSite=Strict` prevents CSRF attacks
- Configurable domain for multi-subdomain scenarios

### Token Validation
- Refresh tokens from cookies undergo same validation as body tokens
- No difference in security level between storage methods
- Both methods support token rotation

### Environment Configuration
```bash
# Optional environment variables for cookie configuration
COOKIE_DOMAIN=.example.com  # For multi-subdomain support
NODE_ENV=production        # Enables secure flag
```

## Migration Strategy

### Backward Compatibility
- All existing API calls without `persistent` parameter work unchanged
- Existing clients continue to receive refresh tokens in response body
- No breaking changes to current authentication flow

### Gradual Rollout
1. Deploy backend changes with feature flag
2. Update frontend to support persistent option
3. Enable feature for beta users
4. Full rollout after validation