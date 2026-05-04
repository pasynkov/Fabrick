import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { ReposService } from './repos.service';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { ApiKeyEncryptionService } from '../api-keys/api-key-encryption.service';
import { ApiKeyValidationService } from '../api-keys/api-key-validation.service';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

const mockProjectRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockRepoRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((v) => v),
});
const mockMemberRepo = () => ({
  findOne: jest.fn(),
});

describe('ReposService', () => {
  let service: ReposService;
  let projectRepo: ReturnType<typeof mockProjectRepo>;
  let repoRepo: ReturnType<typeof mockRepoRepo>;
  let memberRepo: ReturnType<typeof mockMemberRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReposService,
        { provide: getRepositoryToken(Project), useFactory: mockProjectRepo },
        { provide: getRepositoryToken(Repository), useFactory: mockRepoRepo },
        { provide: getRepositoryToken(OrgMember), useFactory: mockMemberRepo },
        { provide: ApiKeyEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn(), generateKeyHash: jest.fn() } },
        { provide: ApiKeyValidationService, useValue: { validateFormat: jest.fn() } },
        { provide: ApiKeyAuditService, useValue: { logApiKeySet: jest.fn(), logApiKeyDelete: jest.fn(), logValidationFailure: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReposService);
    projectRepo = module.get(getRepositoryToken(Project));
    repoRepo = module.get(getRepositoryToken(Repository));
    memberRepo = module.get(getRepositoryToken(OrgMember));
  });

  describe('createProject', () => {
    it('creates project for member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      projectRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'proj1', name: 'My Project', slug: 'my-project', orgId: 'org1' };
      projectRepo.save.mockResolvedValue(saved);

      const result = await service.createProject('uid1', 'org1', 'My Project');

      expect(result).toEqual({ id: 'proj1', name: 'My Project', slug: 'my-project', orgId: 'org1' });
    });

    it('throws ForbiddenException for non-member', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.createProject('uid1', 'org1', 'My Project')).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if slug taken', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      projectRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.createProject('uid1', 'org1', 'My Project')).rejects.toThrow(ConflictException);
    });
  });

  describe('createRepo', () => {
    it('creates repo under project', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'proj1', orgId: 'org1' });
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      repoRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
      repoRepo.save.mockResolvedValue(saved);

      const result = await service.createRepo('uid1', 'proj1', 'myrepo', 'https://github.com/org/myrepo.git');

      expect(result).toMatchObject({ id: 'repo1', projectId: 'proj1' });
      expect(repoRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ gitRemote: 'github.com/org/myrepo' }),
      );
    });

    it('throws ConflictException if git remote already registered', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'proj1', orgId: 'org1' });
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      repoRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.createRepo('uid1', 'proj1', 'myrepo', 'https://github.com/org/myrepo.git')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown project', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.createRepo('uid1', 'proj1', 'myrepo', 'https://github.com/org/myrepo.git')).rejects.toThrow(NotFoundException);
    });
  });

  describe('requireOrgMember', () => {
    it('passes for member', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'member' });
      await expect(service.requireOrgMember('uid1', 'org1')).resolves.not.toThrow();
    });

    it('throws ForbiddenException for non-member', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(service.requireOrgMember('uid1', 'org1')).rejects.toThrow(ForbiddenException);
    });
  });
});
