import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { DossierRepository, DossierPage, DossierPageRef } from '@app/shared';
import { DossierPage as DossierPageEntity } from '../entities/dossier-page.entity';
import { Repository as RepositoryEntity } from '../../entities/repository.entity';

@Injectable()
export class TypeOrmDossierSearchRepository implements DossierRepository {
  constructor(
    @InjectRepository(DossierPageEntity)
    private readonly dossierRepo: TypeOrmRepository<DossierPageEntity>,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepo: TypeOrmRepository<RepositoryEntity>,
  ) {}

  async listScopes(projectId: string, repoSlug: string): Promise<Array<{ scope: string; pageCount: number }>> {
    const rows = await this.dossierRepo
      .createQueryBuilder('dp')
      .innerJoin(RepositoryEntity, 'r', 'r.id = dp.repoId AND r.projectId = :projectId', { projectId })
      .where('r.slug = :repoSlug', { repoSlug })
      .select('dp.scope', 'scope')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dp.scope')
      .getRawMany<{ scope: string; count: string }>();
    return rows.map((r) => ({ scope: r.scope, pageCount: parseInt(r.count, 10) }));
  }

  async listInScope(
    projectId: string,
    repoSlug: string,
    scope: string,
  ): Promise<Array<{ slug: string; title: string; oneLiner: string }>> {
    const rows = await this.dossierRepo
      .createQueryBuilder('dp')
      .innerJoin(RepositoryEntity, 'r', 'r.id = dp.repoId AND r.projectId = :projectId', { projectId })
      .where('r.slug = :repoSlug AND dp.scope = :scope', { repoSlug, scope })
      .select(['dp.slug AS slug', 'dp.title AS title', 'LEFT(dp.content, 500) AS content_head'])
      .getRawMany<{ slug: string; title: string; content_head: string }>();
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      oneLiner: extractOneLiner(r.content_head),
    }));
  }

  async findPage(
    projectId: string,
    repoSlug: string,
    scope: string,
    slug: string,
  ): Promise<DossierPage | null> {
    const entity = await this.dossierRepo
      .createQueryBuilder('dp')
      .innerJoin(RepositoryEntity, 'r', 'r.id = dp.repoId AND r.projectId = :projectId', { projectId })
      .where('r.slug = :repoSlug AND dp.scope = :scope AND dp.slug = :slug', { repoSlug, scope, slug })
      .getOne();
    if (!entity) return null;
    return { repoSlug, scope: entity.scope, slug: entity.slug, content: entity.content };
  }

  async findPages(projectId: string, refs: DossierPageRef[]): Promise<DossierPage[]> {
    if (refs.length === 0) return [];
    const results: DossierPage[] = [];
    for (const ref of refs) {
      const page = await this.findPage(projectId, ref.repoSlug, ref.scope, ref.slug);
      if (page) results.push(page);
    }
    return results;
  }
}

function extractOneLiner(content: string): string {
  // Strip YAML frontmatter
  let body = content;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4);
  }
  // Skip H1 heading
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  let start = 0;
  if (lines[0]?.startsWith('#')) start = 1;
  // Return first non-empty line
  const firstLine = lines[start] ?? '';
  return firstLine.slice(0, 200);
}
