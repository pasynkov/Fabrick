import { Test } from '@nestjs/testing';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { StorageService } from '../storage/storage.service';
import { SynthesisService } from '../synthesis/synthesis.service';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { IsAdminGuard } from '../auth/is-admin.guard';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

const mockReposService = () => ({
  createProject: jest.fn(),
  listProjects: jest.fn(),
  createRepo: jest.fn(),
  listRepos: jest.fn(),
  findOrCreateRepo: jest.fn(),
  requireOrgMemberByRepo: jest.fn(),
  getRepoWithContext: jest.fn(),
  getProjectByRepo: jest.fn(),
});
const mockStorageService = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  listObjects: jest.fn(),
});
const mockSynthesisService = () => ({
  triggerForProject: jest.fn(),
});

describe('ReposController', () => {
  let controller: ReposController;
  let reposService: ReturnType<typeof mockReposService>;

  beforeEach(async () => {
    const passGuard = { canActivate: () => true };
    const module = await Test.createTestingModule({
      controllers: [ReposController],
      providers: [
        { provide: ReposService, useFactory: mockReposService },
        { provide: StorageService, useFactory: mockStorageService },
        { provide: ApiKeyAuditService, useValue: {} },
        { provide: SynthesisService, useFactory: mockSynthesisService },
      ],
    })
      .overrideGuard(FabrickAuthGuard)
      .useValue(passGuard)
      .overrideGuard(IsAdminGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get(ReposController);
    reposService = module.get(ReposService);
  });

  it('createProject delegates to reposService.createProject', async () => {
    const expected = { id: 'proj1', name: 'My Project', slug: 'my-project', orgId: 'org1' };
    reposService.createProject.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.createProject(req as any, 'org1', { name: 'My Project' } as any);

    expect(reposService.createProject).toHaveBeenCalledWith('uid1', 'org1', 'My Project');
    expect(result).toBe(expected);
  });

  it('createRepo delegates to reposService.createRepo', async () => {
    const expected = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
    reposService.createRepo.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.createRepo(req as any, 'proj1', { name: 'myrepo', gitRemote: 'https://github.com/org/myrepo.git' } as any);

    expect(reposService.createRepo).toHaveBeenCalledWith('uid1', 'proj1', 'myrepo', 'https://github.com/org/myrepo.git');
    expect(result).toBe(expected);
  });

  it('findOrCreateRepo delegates to reposService.findOrCreateRepo and returns repo', async () => {
    const repo = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
    reposService.findOrCreateRepo.mockResolvedValue({ status: 201, repo });
    const req = { user: { id: 'uid1' } };

    const result = await controller.findOrCreateRepo(req as any, { gitRemote: 'https://github.com/org/myrepo.git', projectId: 'proj1' } as any);

    expect(reposService.findOrCreateRepo).toHaveBeenCalledWith('uid1', 'https://github.com/org/myrepo.git', 'proj1');
    expect(result).toBe(repo);
  });
});

describe('ReposController — uploadContext synthesis triggering', () => {
  let controller: ReposController;
  let reposService: ReturnType<typeof mockReposService>;
  let storageService: ReturnType<typeof mockStorageService>;
  let synthesisService: ReturnType<typeof mockSynthesisService>;

  const makeZip = (): Promise<Express.Multer.File> => {
    return new Promise((resolve, reject) => {
      const archiver = require('archiver');
      const { PassThrough } = require('stream');
      const chunks: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, fieldname: 'file', originalname: 'context.zip', mimetype: 'application/zip', size: buffer.length } as Express.Multer.File);
      });
      pass.on('error', reject);
      const archive = archiver.default('zip');
      archive.pipe(pass);
      archive.append('hello', { name: 'test.txt' });
      archive.finalize().catch(reject);
    });
  };

  beforeEach(async () => {
    const passGuard = { canActivate: () => true };
    const module = await Test.createTestingModule({
      controllers: [ReposController],
      providers: [
        { provide: ReposService, useFactory: mockReposService },
        { provide: StorageService, useFactory: mockStorageService },
        { provide: ApiKeyAuditService, useValue: {} },
        { provide: SynthesisService, useFactory: mockSynthesisService },
      ],
    })
      .overrideGuard(FabrickAuthGuard)
      .useValue(passGuard)
      .overrideGuard(IsAdminGuard)
      .useValue(passGuard)
      .compile();

    controller = module.get(ReposController);
    reposService = module.get(ReposService);
    storageService = module.get(StorageService);
    synthesisService = module.get(SynthesisService);

    reposService.requireOrgMemberByRepo.mockResolvedValue(undefined);
    reposService.getRepoWithContext.mockResolvedValue({
      orgSlug: 'org1',
      projectSlug: 'proj1',
      repo: { slug: 'repo1' },
    });
    storageService.putObject.mockResolvedValue(undefined);
    synthesisService.triggerForProject.mockResolvedValue(undefined);
  });

  it('triggers synthesis when autoSynthesisEnabled is true', async () => {
    reposService.getProjectByRepo.mockResolvedValue({ id: 'proj-id', autoSynthesisEnabled: true });
    const file = await makeZip();
    const req = { user: { id: 'uid1' } };

    await controller.uploadContext(req as any, 'repo1', file, { triggerSynthesis: false } as any);

    expect(synthesisService.triggerForProject).toHaveBeenCalledWith('proj-id', 'uid1');
  });

  it('triggers synthesis when triggerSynthesis flag is true and autoSynthesisEnabled is false', async () => {
    reposService.getProjectByRepo.mockResolvedValue({ id: 'proj-id', autoSynthesisEnabled: false });
    const file = await makeZip();
    const req = { user: { id: 'uid1' } };

    await controller.uploadContext(req as any, 'repo1', file, { triggerSynthesis: true } as any);

    expect(synthesisService.triggerForProject).toHaveBeenCalledWith('proj-id', 'uid1');
  });

  it('does not trigger synthesis when autoSynthesisEnabled is false and no triggerSynthesis flag', async () => {
    reposService.getProjectByRepo.mockResolvedValue({ id: 'proj-id', autoSynthesisEnabled: false });
    const file = await makeZip();
    const req = { user: { id: 'uid1' } };

    await controller.uploadContext(req as any, 'repo1', file, { triggerSynthesis: false } as any);

    expect(synthesisService.triggerForProject).not.toHaveBeenCalled();
  });

  it('upload succeeds even when synthesis trigger throws', async () => {
    reposService.getProjectByRepo.mockResolvedValue({ id: 'proj-id', autoSynthesisEnabled: true });
    synthesisService.triggerForProject.mockRejectedValue(new Error('queue down'));
    const file = await makeZip();
    const req = { user: { id: 'uid1' } };

    await expect(
      controller.uploadContext(req as any, 'repo1', file, { triggerSynthesis: false } as any),
    ).resolves.toBeUndefined();
  });
});
