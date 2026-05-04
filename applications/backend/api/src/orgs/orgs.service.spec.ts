import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { OrgsService } from './orgs.service';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { ApiKeyEncryptionService } from '../api-keys/api-key-encryption.service';
import { ApiKeyValidationService } from '../api-keys/api-key-validation.service';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

const mockOrgRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockMemberRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});

describe('OrgsService', () => {
  let service: OrgsService;
  let orgRepo: ReturnType<typeof mockOrgRepo>;
  let memberRepo: ReturnType<typeof mockMemberRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrgsService,
        { provide: getRepositoryToken(Organization), useFactory: mockOrgRepo },
        { provide: getRepositoryToken(OrgMember), useFactory: mockMemberRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: ApiKeyEncryptionService, useValue: {} },
        { provide: ApiKeyValidationService, useValue: {} },
        { provide: ApiKeyAuditService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrgsService);
    orgRepo = module.get(getRepositoryToken(Organization));
    memberRepo = module.get(getRepositoryToken(OrgMember));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('createOrg', () => {
    it('creates org and admin membership', async () => {
      orgRepo.findOne.mockResolvedValue(null);
      const savedOrg = { id: 'org1', name: 'My Org', slug: 'my-org' };
      orgRepo.save.mockResolvedValue(savedOrg);
      memberRepo.save.mockResolvedValue({});

      const result = await service.createOrg('uid1', 'My Org');

      expect(result).toEqual({ id: 'org1', name: 'My Org', slug: 'my-org' });
      expect(memberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org1', userId: 'uid1', role: 'admin' }),
      );
    });

    it('throws ConflictException if slug taken', async () => {
      orgRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.createOrg('uid1', 'My Org')).rejects.toThrow(ConflictException);
    });
  });

  describe('listOrgs', () => {
    it('returns orgs with role', async () => {
      memberRepo.find.mockResolvedValue([
        { org: { id: 'org1', name: 'Acme', slug: 'acme' }, role: 'admin' },
      ]);
      const result = await service.listOrgs('uid1');
      expect(result).toEqual([{ id: 'org1', name: 'Acme', slug: 'acme', role: 'admin' }]);
    });
  });

  describe('requireAdmin', () => {
    it('passes for admin member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      await expect(service.requireAdmin('uid1', 'org1')).resolves.not.toThrow();
    });

    it('throws ForbiddenException for non-member', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.requireAdmin('uid1', 'org1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for non-admin member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'member' });
      await expect(service.requireAdmin('uid1', 'org1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('requireMember', () => {
    it('passes for any member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'member' });
      await expect(service.requireMember('uid1', 'org1')).resolves.not.toThrow();
    });

    it('throws ForbiddenException for non-member', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.requireMember('uid1', 'org1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOrgBySlug', () => {
    it('returns org', async () => {
      const org = { id: 'org1', slug: 'acme' };
      orgRepo.findOne.mockResolvedValue(org);
      const result = await service.getOrgBySlug('acme');
      expect(result).toBe(org);
    });

    it('throws NotFoundException if not found', async () => {
      orgRepo.findOne.mockResolvedValue(null);
      await expect(service.getOrgBySlug('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
