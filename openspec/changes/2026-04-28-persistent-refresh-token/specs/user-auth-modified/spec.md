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
The system SHALL expose `POST /auth/register` accepting `{ email, password, persistent? }`. When `persistent=true`, it SHALL set the refresh token as an httpOnly cookie instead of returning it in the response body.

#### Scenario: Successful registration with persistent login
- **WHEN** a client sends `POST /auth/register` with `persistent: true`
- **THEN** the system returns `{ access_token, user: { id, email } }` and sets `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict`

#### Scenario: Successful registration with session login
- **WHEN** a client sends `POST /auth/register` with `persistent: false` or omitted
- **THEN** the system returns `{ access_token, refresh_token, user: { id, email } }` (current behavior)

### Requirement: Enhanced user login with persistent option
The system SHALL expose `POST /auth/login` accepting `{ email, password, persistent? }`. When `persistent=true`, it SHALL set the refresh token as an httpOnly cookie instead of returning it in the response body.

#### Scenario: Successful login with persistent option
- **WHEN** a client sends `POST /auth/login` with `persistent: true` and correct credentials
- **THEN** the system returns `{ access_token, user: { id, email } }` and sets secure httpOnly cookie

#### Scenario: Successful login without persistent option
- **WHEN** a client sends `POST /auth/login` with correct credentials and no persistent flag
- **THEN** the system returns `{ access_token, refresh_token, user: { id, email } }` (current behavior)

### Requirement: Enhanced token refresh with dual source support
The system SHALL expose `POST /auth/refresh` that accepts refresh tokens from both request body and httpOnly cookies. It SHALL prioritize request body over cookies and maintain the same storage method for the new refresh token.

#### Scenario: Refresh with token in request body
- **WHEN** a client sends `POST /auth/refresh` with `{ refresh_token: "..." }`
- **THEN** the system uses the body token and returns `{ access_token, refresh_token }`

#### Scenario: Refresh with token in cookie
- **WHEN** a client sends `POST /auth/refresh` without body token but with refresh_token cookie
- **THEN** the system uses the cookie token, returns `{ access_token }`, and updates the refresh_token cookie

#### Scenario: Refresh with both token sources
- **WHEN** a client sends `POST /auth/refresh` with both body token and cookie token
- **THEN** the system prioritizes the body token and follows body token behavior

### Requirement: Logout endpoint for cookie cleanup
The system SHALL expose `POST /auth/logout` that clears refresh token cookies and invalidates the current session.

#### Scenario: Logout clears cookies
- **WHEN** a client sends `POST /auth/logout`
- **THEN** the system sets `Set-Cookie: refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0` and returns success

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
    const refresh_token = this.signRefreshJwt(user);
    
    return {
      access_token,
      refresh_token: persistent ? undefined : refresh_token,
      user: { id: user.id, email: user.email },
      // For controller to set cookie
      refreshTokenForCookie: persistent ? refresh_token : undefined,
      isPersistent: !!persistent,
    };
  }

  async login(email: string, password: string, persistent?: boolean) {
    // ... existing validation logic
    
    const access_token = this.signJwt(user);
    const refresh_token = this.signRefreshJwt(user);
    
    return {
      access_token,
      refresh_token: persistent ? undefined : refresh_token,
      user: { id: user.id, email: user.email },
      refreshTokenForCookie: persistent ? refresh_token : undefined,
      isPersistent: !!persistent,
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
    // Logout logic can be extended here for token revocation if needed
    return { success: true };
  }

  // ... existing private methods unchanged
}
```

### Enhanced AuthController
```typescript
// auth.controller.ts - Updated endpoints
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() { email, password, persistent }: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(email, password, persistent);
    
    if (result.refreshTokenForCookie) {
      this.setRefreshTokenCookie(response, result.refreshTokenForCookie);
    }
    
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user: result.user,
    };
  }

  @Post('login')
  async login(
    @Body() { email, password, persistent }: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(email, password, persistent);
    
    if (result.refreshTokenForCookie) {
      this.setRefreshTokenCookie(response, result.refreshTokenForCookie);
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
    // Priority: body token > cookie token
    const refreshToken = body.refresh_token || request.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(refreshToken);
    
    // If original token was from cookie, maintain cookie storage
    if (!body.refresh_token && request.cookies?.refresh_token) {
      this.setRefreshTokenCookie(response, result.refresh_token);
      return {
        access_token: result.access_token,
        // Don't return refresh_token in body when using cookies
      };
    }
    
    // Original token was from body, return both in body
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    await this.authService.logout();
    
    // Clear refresh token cookie
    this.clearRefreshTokenCookie(response);
    
    return { success: true };
  }

  // ... existing endpoints (cli-token, etc.) unchanged

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      domain: process.env.COOKIE_DOMAIN, // Optional: set domain if needed
    });
  }

  private clearRefreshTokenCookie(response: Response) {
    response.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      domain: process.env.COOKIE_DOMAIN,
    });
  }
}
```

### Enhanced Module Configuration
```typescript
// auth.module.ts - Add cookie parser middleware
import * as cookieParser from 'cookie-parser';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrgMember]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(cookieParser())
      .forRoutes(AuthController);
  }
}
```

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