import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEvent } from '../../entities/project-event.entity';
import { ListProjectEventsQuery } from './list-project-events.query';
import { ProjectEventDto } from '../dto/project-event.dto';
import { buildTypeFilter } from '../services/event-type-matcher';

export interface ListProjectEventsResult {
  events: ProjectEventDto[];
  nextCursor: string | null;
}

@QueryHandler(ListProjectEventsQuery)
export class ListProjectEventsHandler implements IQueryHandler<ListProjectEventsQuery> {
  constructor(
    @InjectRepository(ProjectEvent)
    private readonly repo: Repository<ProjectEvent>,
  ) {}

  async execute(query: ListProjectEventsQuery): Promise<ListProjectEventsResult> {
    const limit = Math.min(query.limit, 200);

    const qb = this.repo.createQueryBuilder('pe')
      .orderBy('pe.at', 'DESC')
      .addOrderBy('pe.id', 'DESC')
      .take(limit + 1);

    if (query.filter.orgId) qb.andWhere('pe.orgId = :orgId', { orgId: query.filter.orgId });
    if (query.filter.projectId) qb.andWhere('pe.projectId = :projectId', { projectId: query.filter.projectId });
    if (query.filter.repoId) qb.andWhere('pe.repoId = :repoId', { repoId: query.filter.repoId });

    if (query.since) {
      qb.andWhere('pe.id < :since', { since: query.since });
    }

    if (query.types) {
      const { sql, params } = buildTypeFilter(query.types);
      if (sql) qb.andWhere(sql, params);
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      events: items.map((r) => ProjectEventDto.fromEntity(r)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}
