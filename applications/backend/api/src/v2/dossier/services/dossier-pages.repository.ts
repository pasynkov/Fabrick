import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DossierPage } from '../../entities/dossier-page.entity';
import { parseFrontmatter } from '../../shared/frontmatter.util';

@Injectable()
export class DossierPagesRepository {
  constructor(
    @InjectRepository(DossierPage)
    private readonly repo: Repository<DossierPage>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async upsertChanged(
    orgId: string,
    projectId: string,
    repoId: string,
    scope: string,
    bodies: Record<string, string>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const [slug, content] of Object.entries(bodies)) {
        const frontmatter = parseFrontmatter(content);
        const title = (frontmatter['title'] as string) || slug;
        const sources = (frontmatter['sources'] as string[]) || [];
        const related = (frontmatter['related'] as string[]) || [];

        await manager.upsert(
          DossierPage,
          {
            orgId,
            projectId,
            repoId,
            scope,
            slug,
            title,
            content,
            sources,
            related,
            frontmatter,
            updatedAt: new Date(),
          },
          { conflictPaths: ['repoId', 'scope', 'slug'] },
        );
      }
    });
  }

  async deleteScope(repoId: string, scope: string): Promise<void> {
    await this.repo.delete({ repoId, scope });
  }

  async findByRepo(repoId: string): Promise<DossierPage[]> {
    return this.repo.find({
      where: { repoId },
      order: { scope: 'ASC', slug: 'ASC' },
    });
  }
}
