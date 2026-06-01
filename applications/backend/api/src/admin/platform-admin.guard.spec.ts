import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

function makeContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminGuard', () => {
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    guard = new PlatformAdminGuard();
  });

  it('allows a platform admin', () => {
    const ctx = makeContext({ id: '1', email: 'admin@example.com', isPlatformAdmin: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a non-admin authenticated user', () => {
    const ctx = makeContext({ id: '2', email: 'user@example.com', isPlatformAdmin: false });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request (no user)', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects when isPlatformAdmin is missing', () => {
    const ctx = makeContext({ id: '3', email: 'user@example.com' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
