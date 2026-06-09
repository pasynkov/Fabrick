import { FrontmatterService } from './frontmatter.service';

describe('FrontmatterService', () => {
  let service: FrontmatterService;

  beforeEach(() => { service = new FrontmatterService(); });

  it('stamps a body with correct frontmatter fields', () => {
    const meta = { name: 'api — service', description: 'HTTP API', type: 'dossier' as const, repo: 'mono', scope: 'apps/api', slug: 'service.md', sha: 'abc', updatedAt: '2025-01-01' };
    const stamped = service.stamp(meta, '# Body\n');
    expect(stamped).toMatch(/^---\n/);
    expect(stamped).toContain('name:');
    expect(stamped).toContain('type: dossier');
    expect(stamped).toContain('slug: service.md');
  });

  it('strips existing frontmatter before re-stamping', () => {
    const original = '---\nname: old\n---\n# Body\n';
    const meta = { name: 'new', description: '', type: 'dossier' as const, repo: 'r', scope: 's', slug: 'x.md', sha: 'h', updatedAt: 't' };
    const stamped = service.stamp(meta, original);
    expect(stamped).not.toContain('old');
    expect(stamped).toContain('name: new');
  });
});
