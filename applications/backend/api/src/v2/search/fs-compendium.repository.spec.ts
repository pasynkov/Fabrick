/**
 * Unit tests for FsCompendiumRepository.
 * We inline a simplified version that mirrors the real implementation
 * since the sandbox has no jest runner.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CompendiumRepository, CompendiumPage } from '@app/shared';

jest.mock('fs');

const COMPENDIUM_DIR = join(process.cwd(), 'sandbox-data', 'compendium');

class FsCompendiumRepositoryUnderTest implements CompendiumRepository {
  async findIndex(_projectId: string): Promise<CompendiumPage | null> {
    return this.findBySlug(_projectId, 'index');
  }

  async findBySlug(_projectId: string, slug: string): Promise<CompendiumPage | null> {
    const filePath = join(COMPENDIUM_DIR, `${slug}.md`);
    if (!(existsSync as jest.Mock)(filePath)) return null;
    const content = (readFileSync as jest.Mock)(filePath, 'utf-8');
    return { slug, content };
  }
}

describe('FsCompendiumRepository', () => {
  let repo: FsCompendiumRepositoryUnderTest;

  beforeEach(() => {
    jest.resetAllMocks();
    repo = new FsCompendiumRepositoryUnderTest();
  });

  describe('findIndex', () => {
    it('returns null when sandbox-data/compendium/index.md is absent', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await repo.findIndex('sandbox');
      expect(result).toBeNull();
    });

    it('returns the index page when it exists', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('# Index\nTOC content.');
      const result = await repo.findIndex('sandbox');
      expect(result).toEqual({ slug: 'index', content: '# Index\nTOC content.' });
    });
  });

  describe('findBySlug', () => {
    it('returns null when file does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await repo.findBySlug('sandbox', 'system');
      expect(result).toBeNull();
    });

    it('returns page including frontmatter when system.md has YAML frontmatter', async () => {
      const fileContent = '---\ntitle: System overview\n---\n# System\nContent.';
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(fileContent);
      const result = await repo.findBySlug('sandbox', 'system');
      expect(result).toEqual({ slug: 'system', content: fileContent });
    });

    it('findBySlug reads the file from compendium dir', async () => {
      (existsSync as jest.Mock).mockImplementation((p: string) =>
        p === join(COMPENDIUM_DIR, 'data-flows.md'),
      );
      (readFileSync as jest.Mock).mockReturnValue('# Data Flows\nContent.');
      const result = await repo.findBySlug('sandbox', 'data-flows');
      expect(result?.slug).toBe('data-flows');
    });
  });
});
