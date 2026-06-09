import { TypeOrmCompendiumSearchRepository } from './typeorm-compendium-search.repository';

describe('TypeOrmCompendiumSearchRepository', () => {
  let mockRepo: any;
  let repository: TypeOrmCompendiumSearchRepository;

  beforeEach(() => {
    mockRepo = { findOne: jest.fn() };
    repository = new TypeOrmCompendiumSearchRepository(mockRepo);
  });

  describe('findIndex', () => {
    it('returns null when no index row exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await repository.findIndex('project-1');
      expect(result).toBeNull();
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { projectId: 'project-1', slug: 'index' } });
    });

    it('returns the index page when it exists', async () => {
      mockRepo.findOne.mockResolvedValue({ slug: 'index', content: '# Index\nContent.' });
      const result = await repository.findIndex('project-1');
      expect(result).toEqual({ slug: 'index', content: '# Index\nContent.' });
    });
  });

  describe('findBySlug', () => {
    it('returns null when slug not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await repository.findBySlug('project-1', 'system');
      expect(result).toBeNull();
    });

    it('returns the page for system slug', async () => {
      mockRepo.findOne.mockResolvedValue({ slug: 'system', content: '# System\nOverview.' });
      const result = await repository.findBySlug('project-1', 'system');
      expect(result).toEqual({ slug: 'system', content: '# System\nOverview.' });
    });

    it('returns the page for data-flows slug', async () => {
      mockRepo.findOne.mockResolvedValue({ slug: 'data-flows', content: '# Data Flows\nContent.' });
      const result = await repository.findBySlug('project-1', 'data-flows');
      expect(result?.slug).toBe('data-flows');
    });

    it('returns the page for transport-graph slug', async () => {
      mockRepo.findOne.mockResolvedValue({ slug: 'transport-graph', content: '# Transport Graph\nContent.' });
      const result = await repository.findBySlug('project-1', 'transport-graph');
      expect(result?.slug).toBe('transport-graph');
    });

    it('returns the page for infra slug', async () => {
      mockRepo.findOne.mockResolvedValue({ slug: 'infra', content: '# Infra\nContent.' });
      const result = await repository.findBySlug('project-1', 'infra');
      expect(result?.slug).toBe('infra');
    });
  });
});
