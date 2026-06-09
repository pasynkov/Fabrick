import { TypeOrmDossierSearchRepository } from './typeorm-dossier-search.repository';

function makeQueryBuilder(result: any) {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(result),
    getOne: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

describe('TypeOrmDossierSearchRepository', () => {
  let dossierRepo: any;
  let repoRepo: any;
  let repository: TypeOrmDossierSearchRepository;

  beforeEach(() => {
    dossierRepo = { createQueryBuilder: jest.fn() };
    repoRepo = { createQueryBuilder: jest.fn() };
    repository = new TypeOrmDossierSearchRepository(dossierRepo, repoRepo);
  });

  describe('listScopes', () => {
    it('returns distinct scopes with counts via the repositories join', async () => {
      const qb = makeQueryBuilder([
        { scope: 'web', count: '4' },
        { scope: 'worker', count: '4' },
      ]);
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.listScopes('p1', 'backend-api');

      expect(result).toEqual([
        { scope: 'web', pageCount: 4 },
        { scope: 'worker', pageCount: 4 },
      ]);
    });

    it('returns empty array when no scopes', async () => {
      const qb = makeQueryBuilder([]);
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.listScopes('p1', 'no-repo');
      expect(result).toEqual([]);
    });
  });

  describe('listInScope', () => {
    it('returns slug/title/oneLiner for pages in scope', async () => {
      const qb = makeQueryBuilder([
        { slug: 'service', title: 'Web service', content_head: '# Web service\n\nServes HTTP traffic.' },
      ]);
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.listInScope('p1', 'backend-api', 'web');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('service');
      expect(result[0].title).toBe('Web service');
      expect(result[0].oneLiner).toBe('Serves HTTP traffic.');
    });

    it('returns empty array when no pages in scope', async () => {
      const qb = makeQueryBuilder([]);
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.listInScope('p1', 'backend-api', 'empty-scope');
      expect(result).toEqual([]);
    });
  });

  describe('findPage', () => {
    it('translates repoSlug to repoId via join and returns page', async () => {
      const qb = makeQueryBuilder({
        scope: 'web',
        slug: 'service',
        content: '# Service content',
        repoId: 'some-uuid',
      });
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findPage('p1', 'backend-api', 'web', 'service');

      expect(result).toEqual({
        repoSlug: 'backend-api',
        scope: 'web',
        slug: 'service',
        content: '# Service content',
      });
    });

    it('returns null when page not found', async () => {
      const qb = makeQueryBuilder(null);
      dossierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findPage('p1', 'backend-api', 'web', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('findPages', () => {
    it('returns only existing rows', async () => {
      // First call returns a page, second returns null (missing)
      const existingQb = makeQueryBuilder({
        scope: 'x',
        slug: 'service',
        content: '# Service',
        repoId: 'uuid',
      });
      const missingQb = makeQueryBuilder(null);
      dossierRepo.createQueryBuilder
        .mockReturnValueOnce(existingQb)
        .mockReturnValueOnce(missingQb);

      const refs = [
        { repoSlug: 'a', scope: 'x', slug: 'service' },
        { repoSlug: 'a', scope: 'x', slug: 'missing' },
      ];

      const result = await repository.findPages('p1', refs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ repoSlug: 'a', scope: 'x', slug: 'service', content: '# Service' });
    });

    it('returns empty array when no refs provided', async () => {
      const result = await repository.findPages('p1', []);
      expect(result).toEqual([]);
    });
  });
});
