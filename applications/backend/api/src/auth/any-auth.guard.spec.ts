import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { AnyAuthGuard } from './any-auth.guard';

const mockUser = { id: 'user-1', email: 'test@example.com' };

function makeContext(token?: string): ExecutionContext {
  const request: any = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    user: undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AnyAuthGuard', () => {
  let guard: AnyAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let cliTokenRepo: any;
  let userRepo: any;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as any;
    userRepo = { findOne: jest.fn() };
    cliTokenRepo = { findOne: jest.fn() };
    guard = new AnyAuthGuard(jwtService, cliTokenRepo, userRepo);
  });

  it('throws when no Authorization header', async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates via valid JWT', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', email: 'test@example.com' });
    userRepo.findOne.mockResolvedValue(mockUser);

    const ctx = makeContext('valid.jwt.token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(mockUser);
  });

  it('falls back to CLI token when JWT invalid', async () => {
    jwtService.verify.mockImplementation(() => { throw new Error('invalid jwt'); });

    const plaintext = 'abc123';
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    cliTokenRepo.findOne.mockResolvedValue({ userId: 'user-1', tokenHash });
    userRepo.findOne.mockResolvedValue(mockUser);

    const ctx = makeContext(plaintext);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(mockUser);
    expect(cliTokenRepo.findOne).toHaveBeenCalledWith({
      where: { tokenHash },
    });
  });

  it('throws when JWT invalid and CLI token not found', async () => {
    jwtService.verify.mockImplementation(() => { throw new Error('invalid jwt'); });
    cliTokenRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('bad-token'))).rejects.toThrow(UnauthorizedException);
  });

  it('throws when JWT valid but user not found', async () => {
    jwtService.verify.mockReturnValue({ sub: 'ghost', email: 'ghost@example.com' });
    userRepo.findOne
      .mockResolvedValueOnce(null)   // JWT user lookup fails
      .mockResolvedValue(null);       // CLI token user lookup also fails
    cliTokenRepo.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext('valid.jwt.token'))).rejects.toThrow(UnauthorizedException);
  });
});
