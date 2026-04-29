import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FabrickAuthGuard } from './fabrick-auth.guard';
import { RefreshAuthGuard } from './refresh-auth.guard';

const mockAuthService = () => ({
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  revoke: jest.fn(),
  issueCliToken: jest.fn(),
  issueMcpToken: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(async () => {
    const passGuard = { canActivate: () => true };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useFactory: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(passGuard)
      .overrideGuard(FabrickAuthGuard).useValue(passGuard)
      .overrideGuard(RefreshAuthGuard).useValue(passGuard)
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('delegates to authService.register and returns result', async () => {
      const expected = { access_token: 'tok', user: { id: '1', email: 'a@b.com' } };
      authService.register.mockResolvedValue(expected);

      const result = await controller.register({ email: 'a@b.com', password: 'password1' });

      expect(authService.register).toHaveBeenCalledWith('a@b.com', 'password1', undefined);
      expect(result).toBe(expected);
    });

    it('passes persistent=true to authService.register', async () => {
      const expected = { access_token: 'tok', refresh_token: 'ref', user: { id: '1', email: 'a@b.com' } };
      authService.register.mockResolvedValue(expected);

      const result = await controller.register({ email: 'a@b.com', password: 'password1', persistent: true });

      expect(authService.register).toHaveBeenCalledWith('a@b.com', 'password1', true);
      expect(result).toBe(expected);
    });

    it('throws BadRequestException on missing email', async () => {
      await expect(controller.register({ email: '', password: 'password1' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on short password', async () => {
      await expect(controller.register({ email: 'a@b.com', password: 'short' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('delegates to authService.login and returns result', async () => {
      const expected = { access_token: 'tok', user: { id: '1', email: 'a@b.com' } };
      authService.login.mockResolvedValue(expected);

      const result = await controller.login({ email: 'a@b.com', password: 'password1' });

      expect(authService.login).toHaveBeenCalledWith('a@b.com', 'password1', undefined);
      expect(result).toBe(expected);
    });

    it('passes persistent=true to authService.login', async () => {
      const expected = { access_token: 'tok', refresh_token: 'ref', user: { id: '1', email: 'a@b.com' } };
      authService.login.mockResolvedValue(expected);

      const result = await controller.login({ email: 'a@b.com', password: 'password1', persistent: true });

      expect(authService.login).toHaveBeenCalledWith('a@b.com', 'password1', true);
      expect(result).toBe(expected);
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refresh and returns result', async () => {
      const expected = { access_token: 'new-tok', refresh_token: 'new-refresh' };
      authService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh({ refresh_token: 'old-refresh' });

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh');
      expect(result).toBe(expected);
    });
  });

  describe('logout', () => {
    it('delegates to authService.logout and returns result', async () => {
      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout();

      expect(authService.logout).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('revoke', () => {
    it('delegates to authService.revoke and returns result', async () => {
      authService.revoke.mockResolvedValue({});

      const result = await controller.revoke();

      expect(authService.revoke).toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });
});
