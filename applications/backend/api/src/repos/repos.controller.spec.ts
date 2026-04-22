import { Test } from '@nestjs/testing';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { StorageService } from '../storage/storage.service';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';

const mockReposService = () => ({
  createProject: jest.fn(),
  listProjects: jest.fn(),
  createRepo: jest.fn(),
  listRepos: jest.fn(),
  findOrCreateRepo: jest.fn(),
  requireOrgMemberByRepo: jest.fn(),
  getRepoWithContext: jest.fn(),
});
const mockStorageService = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  listObjects: jest.fn(),
});

describe('ReposController', () => {
  let controller: ReposController;
  let reposService: ReturnType<typeof mockReposService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReposController],
      providers: [
        { provide: ReposService, useFactory: mockReposService },
        { provide: StorageService, useFactory: mockStorageService },
      ],
    })
      .overrideGuard(FabrickAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ReposController);
    reposService = module.get(ReposService);
  });

  it('createProject delegates to reposService.createProject', async () => {
    const expected = { id: 'proj1', name: 'My Project', slug: 'my-project', orgId: 'org1' };
    reposService.createProject.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.createProject(req as any, 'org1', { name: 'My Project' });

    expect(reposService.createProject).toHaveBeenCalledWith('uid1', 'org1', 'My Project');
    expect(result).toBe(expected);
  });

  it('createRepo delegates to reposService.createRepo', async () => {
    const expected = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
    reposService.createRepo.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.createRepo(req as any, 'proj1', { name: 'myrepo', gitRemote: 'https://github.com/org/myrepo.git' });

    expect(reposService.createRepo).toHaveBeenCalledWith('uid1', 'proj1', 'myrepo', 'https://github.com/org/myrepo.git');
    expect(result).toBe(expected);
  });

  it('findOrCreateRepo delegates to reposService.findOrCreateRepo and returns repo', async () => {
    const repo = { id: 'repo1', name: 'myrepo', slug: 'myrepo', gitRemote: 'github.com/org/myrepo', projectId: 'proj1' };
    reposService.findOrCreateRepo.mockResolvedValue({ status: 201, repo });
    const req = { user: { id: 'uid1' } };

    const result = await controller.findOrCreateRepo(req as any, { gitRemote: 'https://github.com/org/myrepo.git', projectId: 'proj1' });

    expect(reposService.findOrCreateRepo).toHaveBeenCalledWith('uid1', 'https://github.com/org/myrepo.git', 'proj1');
    expect(result).toBe(repo);
  });
});
