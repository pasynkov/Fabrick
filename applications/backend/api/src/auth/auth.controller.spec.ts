import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FabrickAuthGuard } from './fabrick-auth.guard';

const mockAuthService = () => ({
  register: jest.fn(),
  login: jest.fn(),
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
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('delegates to authService.register and returns result', async () => {
      const expected = { access_token: 'tok', user: { id: '1', email: 'a@b.com' } };
      authService.register.mockResolvedValue(expected);

      const result = await controller.register({ email: 'a@b.com', password: 'password1' });

      expect(authService.register).toHaveBeenCalledWith('a@b.com', 'password1');
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

      expect(authService.login).toHaveBeenCalledWith('a@b.com', 'password1');
      expect(result).toBe(expected);
    });
  });
});
