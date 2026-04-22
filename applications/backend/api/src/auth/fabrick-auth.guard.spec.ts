import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FabrickAuthGuard } from './fabrick-auth.guard';

function makeContext(authHeader: string | undefined): ExecutionContext {
  const request = { headers: { authorization: authHeader }, user: undefined as any };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('FabrickAuthGuard', () => {
  let guard: FabrickAuthGuard;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as any;
    guard = new FabrickAuthGuard(jwtService);
  });

  it('accepts valid JWT without fbrk_ prefix', () => {
    jwtService.verify.mockReturnValue({ sub: 'uid1', email: 'a@b.com', type: 'jwt' });
    const ctx = makeContext('Bearer my-jwt');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('my-jwt');
  });

  it('strips fbrk_ prefix before verifying', () => {
    jwtService.verify.mockReturnValue({ sub: 'uid1', email: 'a@b.com', type: 'cli' });
    const ctx = makeContext('Bearer fbrk_my-jwt');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('my-jwt');
  });

  it('sets request.user from JWT payload', () => {
    const payload = { sub: 'uid1', email: 'a@b.com', type: 'mcp', org: 'myorg', project: 'myproject', repo: 'repo1' };
    jwtService.verify.mockReturnValue(payload);
    const request = { headers: { authorization: 'Bearer fbrk_tok' }, user: undefined as any };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect(request.user).toEqual({
      id: 'uid1',
      email: 'a@b.com',
      type: 'mcp',
      org: 'myorg',
      project: 'myproject',
      repo: 'repo1',
    });
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header does not start with Bearer', () => {
    const ctx = makeContext('Basic dXNlcjpwYXNz');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when JWT verification fails', () => {
    jwtService.verify.mockImplementation(() => { throw new Error('invalid signature'); });
    const ctx = makeContext('Bearer bad-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when fbrk_ token has invalid JWT', () => {
    jwtService.verify.mockImplementation(() => { throw new Error('jwt malformed'); });
    const ctx = makeContext('Bearer fbrk_not-a-jwt');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
