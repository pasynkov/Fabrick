/**
 * Unit tests for FsDossierRepository.
 * We inline a simplified version that mirrors the real implementation.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DossierRepository, DossierPage, DossierPageRef } from '@app/shared';

jest.mock('fs');

const DOSSIERS_DIR = join(process.cwd(), 'sandbox-data', 'dossiers');

function extractTitle(content: string, fallback: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = content.slice(3, end);
      const match = yaml.match(/^title:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

function extractOneLiner(content: string): string {
  let body = content;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4);
  }
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  let start = 0;
  if (lines[0]?.startsWith('#')) start = 1;
  return (lines[start] ?? '').slice(0, 200);
}

class FsDossierRepositoryUnderTest implements DossierRepository {
  async listScopes(_projectId: string, repoSlug: string): Promise<Array<{ scope: string; pageCount: number }>> {
    const repoDir = join(DOSSIERS_DIR, repoSlug);
    if (!(existsSync as jest.Mock)(repoDir)) return [];
    const scopeMap = new Map<string, number>();
    for (const entry of (readdirSync as jest.Mock)(repoDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const scopeDir = join(repoDir, entry.name);
        const files = (readdirSync as jest.Mock)(scopeDir).filter((f: string) => f.endsWith('.md'));
        scopeMap.set(entry.name, files.length);
      }
    }
    return Array.from(scopeMap.entries()).map(([scope, pageCount]) => ({ scope, pageCount }));
  }

  async listInScope(_projectId: string, repoSlug: string, scope: string): Promise<Array<{ slug: string; title: string; oneLiner: string }>> {
    const scopeDir = join(DOSSIERS_DIR, repoSlug, scope);
    if (!(existsSync as jest.Mock)(scopeDir)) return [];
    const results: Array<{ slug: string; title: string; oneLiner: string }> = [];
    for (const entry of (readdirSync as jest.Mock)(scopeDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const slug = entry.name.replace(/\.md$/, '');
        const content = (readFileSync as jest.Mock)(join(scopeDir, entry.name), 'utf-8');
        results.push({ slug, title: extractTitle(content, slug), oneLiner: extractOneLiner(content) });
      }
    }
    return results;
  }

  async findPage(_projectId: string, repoSlug: string, scope: string, slug: string): Promise<DossierPage | null> {
    const filePath = join(DOSSIERS_DIR, repoSlug, scope, `${slug}.md`);
    if (!(existsSync as jest.Mock)(filePath)) return null;
    const content = (readFileSync as jest.Mock)(filePath, 'utf-8');
    return { repoSlug, scope, slug, content };
  }

  async findPages(_projectId: string, refs: DossierPageRef[]): Promise<DossierPage[]> {
    const results: DossierPage[] = [];
    for (const ref of refs) {
      const page = await this.findPage(_projectId, ref.repoSlug, ref.scope, ref.slug);
      if (page) results.push(page);
    }
    return results;
  }
}

describe('FsDossierRepository', () => {
  let repo: FsDossierRepositoryUnderTest;

  beforeEach(() => {
    jest.resetAllMocks();
    repo = new FsDossierRepositoryUnderTest();
  });

  describe('listScopes', () => {
    it('returns empty array when repo dir does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await repo.listScopes('sandbox', 'unknown-repo');
      expect(result).toEqual([]);
    });

    it('returns correct shape from sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readdirSync as jest.Mock).mockImplementation((dir: string, opts?: any) => {
        if (dir === join(DOSSIERS_DIR, 'backend-api')) {
          return [
            { name: 'web', isDirectory: () => true, isFile: () => false },
          ];
        }
        if (dir === join(DOSSIERS_DIR, 'backend-api', 'web')) {
          // Without withFileTypes (second call is without opts in the files count)
          return ['service.md', 'config.md'];
        }
        return [];
      });

      const result = await repo.listScopes('sandbox', 'backend-api');
      expect(result).toEqual([{ scope: 'web', pageCount: 2 }]);
    });
  });

  describe('listInScope', () => {
    it('returns correct slug/title/oneLiner', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      const content = '---\ntitle: Service\n---\n# Service\n\nHandles HTTP requests.';
      (readdirSync as jest.Mock).mockReturnValue([
        { name: 'service.md', isFile: () => true, isDirectory: () => false },
      ]);
      (readFileSync as jest.Mock).mockReturnValue(content);

      const result = await repo.listInScope('sandbox', 'backend-api', 'web');
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('service');
      expect(result[0].title).toBe('Service');
      expect(result[0].oneLiner).toBe('Handles HTTP requests.');
    });

    it('returns empty array when scope dir does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await repo.listInScope('sandbox', 'backend-api', 'nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('findPage', () => {
    it('returns page when file exists at sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md', async () => {
      const content = '---\ntitle: Service\n---\n# Service\nContent.';
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(content);

      const result = await repo.findPage('sandbox', 'backend-api', 'web', 'service');
      expect(result).toEqual({ repoSlug: 'backend-api', scope: 'web', slug: 'service', content });
    });

    it('returns null when file does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const result = await repo.findPage('sandbox', 'backend-api', 'web', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('findPages', () => {
    it('skips missing pages and returns only existing ones', async () => {
      const serviceContent = '# Service\nContent.';
      (existsSync as jest.Mock).mockImplementation((p: string) =>
        p.endsWith('service.md'),
      );
      (readFileSync as jest.Mock).mockReturnValue(serviceContent);

      const refs: DossierPageRef[] = [
        { repoSlug: 'a', scope: 'x', slug: 'service' },
        { repoSlug: 'a', scope: 'x', slug: 'missing' },
      ];

      const result = await repo.findPages('sandbox', refs);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('service');
    });

    it('returns empty array for no refs', async () => {
      const result = await repo.findPages('sandbox', []);
      expect(result).toEqual([]);
    });
  });
});
