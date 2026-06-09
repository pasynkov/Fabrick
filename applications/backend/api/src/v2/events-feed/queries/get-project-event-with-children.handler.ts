import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectEvent } from '../../entities/project-event.entity';
import { GetProjectEventWithChildrenQuery } from './get-project-event-with-children.query';
import { ProjectEventDto } from '../dto/project-event.dto';

export interface GetProjectEventResult {
  event: ProjectEventDto;
  children: ProjectEventDto[];
}

@QueryHandler(GetProjectEventWithChildrenQuery)
export class GetProjectEventWithChildrenHandler implements IQueryHandler<GetProjectEventWithChildrenQuery> {
  constructor(
    @InjectRepository(ProjectEvent)
    private readonly repo: Repository<ProjectEvent>,
  ) {}

  async execute(query: GetProjectEventWithChildrenQuery): Promise<GetProjectEventResult> {
    const event = await this.repo.findOne({ where: { id: query.eventId } });

    if (!event || event.repoId !== query.repoId) {
      throw new NotFoundException('Event not found');
    }

    const children = await this.repo.find({
      where: { parentId: query.eventId },
      order: { at: 'ASC', id: 'ASC' },
    });

    return {
      event: ProjectEventDto.fromEntity(event),
      children: children.map((c) => ProjectEventDto.fromEntity(c)),
    };
  }
}
