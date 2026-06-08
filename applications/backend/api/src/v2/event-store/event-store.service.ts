import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEvent } from '../entities/project-event.entity';

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(ProjectEvent)
    private readonly repo: Repository<ProjectEvent>,
  ) {}

  async persist(entity: ProjectEvent): Promise<void> {
    await this.repo.save(entity);
  }

  async persistBatch(entities: ProjectEvent[]): Promise<void> {
    if (entities.length === 0) return;
    await this.repo.save(entities);
  }
}
