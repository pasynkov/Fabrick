import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { PromptRecord, PromptRepository } from '@app/shared';
import { PromptRevision } from '../entities/prompt-revision.entity';

@Injectable()
export class DbPromptRepository implements PromptRepository {
  constructor(
    @InjectRepository(PromptRevision)
    private readonly repo: TypeOrmRepository<PromptRevision>,
  ) {}

  async getLatest(name: string, agent: string): Promise<PromptRecord> {
    const entity = await this.repo.findOne({
      where: { name, agent },
      order: { revision: 'DESC' },
    });

    if (!entity) {
      throw new Error(`No prompt found for (${name}, ${agent})`);
    }

    return {
      id: entity.id,
      name: entity.name,
      agent: entity.agent,
      revision: entity.revision,
      content: entity.content,
    };
  }

  async findAllLatest(): Promise<Array<PromptRevision & { updatedAt: Date }>> {
    const rows = await this.repo
      .createQueryBuilder('pr')
      .where(
        `pr.revision = (
          SELECT MAX(pr2.revision)
          FROM prompt_revisions pr2
          WHERE pr2.name = pr.name AND pr2.agent = pr.agent
        )`,
      )
      .orderBy('pr.name', 'ASC')
      .addOrderBy('pr.agent', 'ASC')
      .getMany();
    return rows.map((r) => ({ ...r, updatedAt: r.createdAt }));
  }

  async findLatestForNameAgent(name: string, agent: string): Promise<PromptRevision | null> {
    return this.repo.findOne({
      where: { name, agent },
      order: { revision: 'DESC' },
    });
  }

  async findHistoryForNameAgent(name: string, agent: string): Promise<PromptRevision[]> {
    return this.repo.find({
      where: { name, agent },
      order: { revision: 'DESC' },
      select: ['id', 'name', 'agent', 'revision', 'note', 'createdBy', 'createdAt'],
    });
  }

  async findByRevision(name: string, agent: string, revision: number): Promise<PromptRevision | null> {
    return this.repo.findOne({ where: { name, agent, revision } });
  }

  async findAllFabrickLatest(): Promise<PromptRevision[]> {
    const rows = await this.repo
      .createQueryBuilder('pr')
      .where('pr.agent = :agent', { agent: 'claude' })
      .andWhere('pr.name LIKE :pattern', { pattern: 'fabrick-%' })
      .andWhere(
        `pr.revision = (
          SELECT MAX(pr2.revision)
          FROM prompt_revisions pr2
          WHERE pr2.name = pr.name AND pr2.agent = pr.agent
        )`,
      )
      .getMany();
    return rows;
  }

  async getMaxRevision(name: string, agent: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('pr')
      .select('MAX(pr.revision)', 'maxRevision')
      .where('pr.name = :name AND pr.agent = :agent', { name, agent })
      .getRawOne<{ maxRevision: number | null }>();
    return result?.maxRevision ?? 0;
  }

  async insert(data: {
    name: string;
    agent: string;
    revision: number;
    content: { files: Record<string, string> };
    note?: string;
    createdBy?: string;
  }): Promise<PromptRevision> {
    const entity = this.repo.create({
      name: data.name,
      agent: data.agent,
      revision: data.revision,
      content: data.content,
      note: data.note ?? null,
      createdBy: data.createdBy ?? null,
    });
    return this.repo.save(entity);
  }
}
