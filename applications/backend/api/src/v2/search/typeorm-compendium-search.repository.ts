import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { CompendiumRepository, CompendiumPage } from '@app/shared';
import { CompendiumPage as CompendiumPageEntity } from '../entities/compendium-page.entity';

@Injectable()
export class TypeOrmCompendiumSearchRepository implements CompendiumRepository {
  constructor(
    @InjectRepository(CompendiumPageEntity)
    private readonly repo: TypeOrmRepository<CompendiumPageEntity>,
  ) {}

  async findIndex(projectId: string): Promise<CompendiumPage | null> {
    return this.findBySlug(projectId, 'index');
  }

  async findBySlug(projectId: string, slug: string): Promise<CompendiumPage | null> {
    const entity = await this.repo.findOne({ where: { projectId, slug } });
    if (!entity) return null;
    return { slug: entity.slug, content: entity.content };
  }
}
