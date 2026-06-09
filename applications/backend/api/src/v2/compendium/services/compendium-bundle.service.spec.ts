import { CompendiumBundleService } from './compendium-bundle.service';

describe('CompendiumBundleService — repos field', () => {
  function makeService(repos: any[], dossierPages: any[], compendiumPages: any[] = []) {
    const mockStorage = {
      putObject: jest.fn().mockResolvedValue(undefined),
    };
    const mockRepoRepo = {
      find: jest.fn().mockResolvedValue(repos),
    };
    const mockDossierPageRepo = {
      find: jest.fn().mockResolvedValue(dossierPages),
    };
    const mockCompendiumPageRepo = {
      find: jest.fn().mockResolvedValue(compendiumPages),
    };
    return new CompendiumBundleService(
      mockStorage as any,
      mockRepoRepo as any,
      mockDossierPageRepo as any,
      mockCompendiumPageRepo as any,
    );
  }

  describe('repos field with no dossier pages', () => {
    it('includes repo with scopes: [] when a repo has no dossier pages', async () => {
      const repos = [{ id: 'repo-1', slug: 'backend-api', name: 'Backend API', projectId: 'p1' }];
      const dossierPages: any[] = [];

      const service = makeService(repos, dossierPages);
      await service.assembleAndUpload('my-org', 'p1', 'du-1');

      const uploadedJson = JSON.parse(
        (service as any).storageService.putObject.mock.calls[0][2].toString('utf-8'),
      );

      expect(uploadedJson.repos).toBeDefined();
      expect(uploadedJson.repos).toHaveLength(1);
      expect(uploadedJson.repos[0].slug).toBe('backend-api');
      expect(uploadedJson.repos[0].name).toBe('Backend API');
      expect(uploadedJson.repos[0].scopes).toEqual([]);
    });
  });

  describe('repos field with dossier pages', () => {
    it('lists distinct scopes from dossier_pages for that repo', async () => {
      const repos = [
        { id: 'repo-1', slug: 'backend-api', name: 'Backend API', projectId: 'p1' },
        { id: 'repo-2', slug: 'cli', name: 'CLI', projectId: 'p1' },
      ];
      const dossierPages = [
        { repoId: 'repo-1', scope: 'web', slug: 'service', title: 'Service', content: '# Service' },
        { repoId: 'repo-1', scope: 'web', slug: 'config', title: 'Config', content: '# Config' },
        { repoId: 'repo-1', scope: 'worker', slug: 'jobs', title: 'Jobs', content: '# Jobs' },
        { repoId: 'repo-2', scope: 'cmd', slug: 'push', title: 'Push', content: '# Push' },
      ];

      const service = makeService(repos, dossierPages);
      await service.assembleAndUpload('my-org', 'p1', 'du-1');

      const uploadedJson = JSON.parse(
        (service as any).storageService.putObject.mock.calls[0][2].toString('utf-8'),
      );

      expect(uploadedJson.repos).toHaveLength(2);

      const backendApi = uploadedJson.repos.find((r: any) => r.slug === 'backend-api');
      expect(backendApi.scopes).toHaveLength(2);
      expect(backendApi.scopes).toContain('web');
      expect(backendApi.scopes).toContain('worker');

      const cli = uploadedJson.repos.find((r: any) => r.slug === 'cli');
      expect(cli.scopes).toEqual(['cmd']);
    });
  });

  describe('SHA256 determinism', () => {
    it('produces the same hash for identical inputs', async () => {
      const repos = [{ id: 'repo-1', slug: 'backend-api', name: 'Backend API', projectId: 'p1' }];
      const dossierPages = [
        { repoId: 'repo-1', scope: 'web', slug: 'service', title: 'Service', content: '# Service' },
      ];

      const service1 = makeService(repos, dossierPages);
      const service2 = makeService(repos, dossierPages);

      const { ref: ref1 } = await service1.assembleAndUpload('org', 'p1', 'du-1');
      const { ref: ref2 } = await service2.assembleAndUpload('org', 'p1', 'du-1');

      expect(ref1.hash).toBe(ref2.hash);
    });
  });
});
