import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { SynthesisService } from './synthesis.service';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { StorageService } from '../storage/storage.service';

const mockProjectRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});
const mockOrgRepo = () => ({ findOne: jest.fn() });
const mockMemberRepo = () => ({ findOne: jest.fn() });
const mockRepoRepo = () => ({ find: jest.fn() });
const mockQueue = () => ({ publish: jest.fn(), subscribe: jest.fn() });
const mockStorage = () => ({ putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() });
const mockJwt = () => ({
  sign: jest.fn().mockReturnValue('callback-token'),
  verify: jest.fn(),
});

describe('SynthesisService', () => {
  let service: SynthesisService;
  let projectRepo: ReturnType<typeof mockProjectRepo>;
  let orgRepo: ReturnType<typeof mockOrgRepo>;
  let memberRepo: ReturnType<typeof mockMemberRepo>;
  let repoRepo: ReturnType<typeof mockRepoRepo>;
  let queueService: ReturnType<typeof mockQueue>;
  let jwtService: ReturnType<typeof mockJwt>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SynthesisService,
        { provide: getRepositoryToken(Project), useFactory: mockProjectRepo },
        { provide: getRepositoryToken(Organization), useFactory: mockOrgRepo },
        { provide: getRepositoryToken(OrgMember), useFactory: mockMemberRepo },
        { provide: getRepositoryToken(Repository), useFactory: mockRepoRepo },
        { provide: QUEUE_SERVICE, useFactory: mockQueue },
        { provide: StorageService, useFactory: mockStorage },
        { provide: JwtService, useFactory: mockJwt },
      ],
    }).compile();

    service = module.get(SynthesisService);
    projectRepo = module.get(getRepositoryToken(Project));
    orgRepo = module.get(getRepositoryToken(Organization));
    memberRepo = module.get(getRepositoryToken(OrgMember));
    repoRepo = module.get(getRepositoryToken(Repository));
    queueService = module.get(QUEUE_SERVICE);
    jwtService = module.get(JwtService);
  });

  describe('triggerForProject', () => {
    it('publishes job to synthesis-jobs queue with correct payload', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'proj1', slug: 'myproject', orgId: 'org1', synthStatus: 'idle', synthError: null });
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      orgRepo.findOne.mockResolvedValue({ id: 'org1', slug: 'myorg' });
      repoRepo.find.mockResolvedValue([{ id: 'repo1', slug: 'myrepo' }]);
      projectRepo.update.mockResolvedValue({});
      queueService.publish.mockResolvedValue(undefined);

      await service.triggerForProject('proj1', 'uid1');

      expect(queueService.publish).toHaveBeenCalledWith('synthesis-jobs', expect.objectContaining({
        projectId: 'proj1',
        orgSlug: 'myorg',
        projectSlug: 'myproject',
        repos: [{ id: 'repo1', slug: 'myrepo' }],
        callbackToken: 'callback-token',
      }));
    });

    it('throws ConflictException if synthesis already running', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'proj1', orgId: 'org1', synthStatus: 'running' });
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });

      await expect(service.triggerForProject('proj1', 'uid1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if project not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.triggerForProject('proj1', 'uid1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatusFromCallback', () => {
    it('updates project synthStatus on valid token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'proj1', scope: 'synth-callback' });
      projectRepo.update.mockResolvedValue({});

      await service.updateStatusFromCallback('valid-token', 'proj1', 'done');

      expect(projectRepo.update).toHaveBeenCalledWith('proj1', expect.objectContaining({ synthStatus: 'done' }));
    });

    it('throws UnauthorizedException on invalid token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.updateStatusFromCallback('bad', 'proj1', 'done')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong scope', async () => {
      jwtService.verify.mockReturnValue({ sub: 'proj1', scope: 'wrong-scope' });
      await expect(service.updateStatusFromCallback('t', 'proj1', 'done')).rejects.toThrow(UnauthorizedException);
    });
  });
});
