import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { WikiRepository, WikiPage, WikiPageData } from '@app/shared';
import { WikiPage as WikiPageEntity } from '../entities/wiki-page.entity';

@Injectable()
export class TypeOrmWikiRepository implements WikiRepository {
  constructor(
    @InjectRepository(WikiPageEntity)
    private readonly repo: TypeOrmRepository<WikiPageEntity>,
  ) {}

  async findBySlug(projectId: string, slug: string): Promise<WikiPage | null> {
    const entity = await this.repo.findOne({ where: { projectId, slug } });
    return entity ? this.toWikiPage(entity) : null;
  }

  async findBySlugs(projectId: string, slugs: string[]): Promise<WikiPage[]> {
    if (slugs.length === 0) return [];
    const entities = await this.repo
      .createQueryBuilder('p')
      .where('p.projectId = :projectId AND p.slug = ANY(:slugs)', { projectId, slugs })
      .getMany();
    return entities.map((e) => this.toWikiPage(e));
  }

  async findByProject(projectId: string): Promise<WikiPage[]> {
    const entities = await this.repo.find({ where: { projectId } });
    return entities.map((e) => this.toWikiPage(e));
  }

  async upsert(projectId: string, pages: WikiPageData[]): Promise<void> {
    for (const page of pages) {
      const existing = await this.repo.findOne({ where: { projectId, slug: page.slug } });
      if (existing) {
        await this.repo.update(
          { projectId, slug: page.slug },
          { category: page.category, title: page.title, content: page.content, sources: page.sources, related: page.related },
        );
      } else {
        await this.repo.save(
          this.repo.create({ projectId, slug: page.slug, category: page.category, title: page.title, content: page.content, sources: page.sources, related: page.related }),
        );
      }
    }
  }

  async delete(projectId: string, slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;
    const { In } = await import('typeorm');
    await this.repo.delete({ projectId, slug: In(slugs) });
  }

  private toWikiPage(entity: WikiPageEntity): WikiPage {
    return {
      slug: entity.slug,
      category: entity.category,
      title: entity.title,
      content: entity.content,
      sources: entity.sources,
      related: entity.related,
    };
  }
}
