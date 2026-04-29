import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockOrgRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockOrgMemberRepo = () => ({
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockJwt = () => ({ sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() });

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let orgRepo: ReturnType<typeof mockOrgRepo>;
  let orgMemberRepo: ReturnType<typeof mockOrgMemberRepo>;
  let jwtService: ReturnType<typeof mockJwt>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Organization), useFactory: mockOrgRepo },
        { provide: getRepositoryToken(OrgMember), useFactory: mockOrgMemberRepo },
        { provide: JwtService, useFactory: mockJwt },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    orgRepo = module.get(getRepositoryToken(Organization));
    orgMemberRepo = module.get(getRepositoryToken(OrgMember));
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('hashes password and saves user (session mode, no refresh_token)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const savedUser = { id: 'uid1', email: 'a@b.com' };
      userRepo.save.mockResolvedValue(savedUser);
      orgRepo.findOne.mockResolvedValue(null);
      orgRepo.save.mockResolvedValue({ id: 'org1', slug: 'a' });
      orgMemberRepo.save.mockResolvedValue({});

      const result = await service.register('a@b.com', 'password123');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com' }),
      );
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.passwordHash).toBeDefined();
      expect(await bcrypt.compare('password123', saved.passwordHash)).toBe(true);
      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBeUndefined();
      expect(result.user).toEqual({ id: 'uid1', email: 'a@b.com' });
    });

    it('returns refresh_token when persistent=true', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({ id: 'uid1', email: 'a@b.com' });
      orgRepo.findOne.mockResolvedValue(null);
      orgRepo.save.mockResolvedValue({ id: 'org1', slug: 'a' });
      orgMemberRepo.save.mockResolvedValue({});

      const result = await service.register('a@b.com', 'password123', true);

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
    });

    it('does not return refresh_token when persistent=false', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({ id: 'uid1', email: 'a@b.com' });
      orgRepo.findOne.mockResolvedValue(null);
      orgRepo.save.mockResolvedValue({ id: 'org1', slug: 'a' });
      orgMemberRepo.save.mockResolvedValue({});

      const result = await service.register('a@b.com', 'password123', false);

      expect(result.refresh_token).toBeUndefined();
    });

    it('throws ConflictException if email already registered', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com' });
      await expect(service.register('a@b.com', 'password123')).rejects.toThrow(ConflictException);
    });

    it('creates personal org and admin membership', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({ id: 'uid1', email: 'john@example.com' });
      orgRepo.findOne.mockResolvedValue(null);
      orgRepo.save.mockResolvedValue({ id: 'org1', slug: 'john' });
      orgMemberRepo.save.mockResolvedValue({});

      await service.register('john@example.com', 'password123');

      expect(orgMemberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org1', userId: 'uid1', role: 'admin' }),
      );
    });
  });

  describe('login', () => {
    it('returns access_token without refresh_token in session mode', async () => {
      const passwordHash = await bcrypt.hash('pass1234', 10);
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com', passwordHash });

      const result = await service.login('a@b.com', 'pass1234');

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBeUndefined();
      expect(result.user).toEqual({ id: 'uid1', email: 'a@b.com' });
    });

    it('returns refresh_token when persistent=true', async () => {
      const passwordHash = await bcrypt.hash('pass1234', 10);
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com', passwordHash });

      const result = await service.login('a@b.com', 'pass1234', true);

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(result.user).toEqual({ id: 'uid1', email: 'a@b.com' });
    });

    it('does not return refresh_token when persistent=false', async () => {
      const passwordHash = await bcrypt.hash('pass1234', 10);
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com', passwordHash });

      const result = await service.login('a@b.com', 'pass1234', false);

      expect(result.refresh_token).toBeUndefined();
    });

    it('throws UnauthorizedException on unknown email', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login('x@b.com', 'pass1234')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com', passwordHash });
      await expect(service.login('a@b.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns new access_token and refresh_token on valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uid1', email: 'a@b.com', type: 'refresh', iat: 1000 });
      userRepo.findOne.mockResolvedValue({ id: 'uid1', email: 'a@b.com' });

      const result = await service.refresh('valid-refresh-token');

      expect(result.access_token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
    });

    it('throws UnauthorizedException on invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if token type is not refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uid1', email: 'a@b.com', type: 'access' });
      await expect(service.refresh('wrong-type-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if user not found', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uid1', email: 'a@b.com', type: 'refresh' });
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('returns success: true', async () => {
      const result = await service.logout();
      expect(result).toEqual({ success: true });
    });
  });

  describe('revoke', () => {
    it('returns empty object', async () => {
      const result = await service.revoke();
      expect(result).toEqual({});
    });
  });
});
