import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompendiumPage } from '../../entities/compendium-page.entity';
import { parseFrontmatter } from '../../shared/frontmatter.util';

export interface CompendiumPageInput {
  slug: string;
  title: string;
  content: string;
  sources: string[];
  related: string[];
}

@Injectable()
export class CompendiumPagesRepository {
  constructor(
    @InjectRepository(CompendiumPage)
    private readonly repo: Repository<CompendiumPage>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async upsertAll(
    orgId: string,
    projectId: string,
    pages: CompendiumPageInput[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const page of pages) {
        const frontmatter = parseFrontmatter(page.content);
        await manager.upsert(
          CompendiumPage,
          {
            orgId,
            projectId,
            slug: page.slug,
            title: page.title,
            content: page.content,
            sources: page.sources,
            related: page.related,
            frontmatter,
            updatedAt: new Date(),
          },
          { conflictPaths: ['projectId', 'slug'] },
        );
      }
    });
  }

  async findByProject(projectId: string): Promise<CompendiumPage[]> {
    const allPages = await this.repo.find({ where: { projectId } });
    const order = ['system', 'data-flows', 'transport-graph', 'infra'];
    return allPages.sort((a, b) => {
      const ai = order.indexOf(a.slug);
      const bi = order.indexOf(b.slug);
      if (ai === -1 && bi === -1) return a.slug.localeCompare(b.slug);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
}
