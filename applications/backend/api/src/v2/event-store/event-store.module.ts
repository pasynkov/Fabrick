import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEvent } from '../entities/project-event.entity';
import { EventStoreService } from './event-store.service';
import { UlidService } from './ulid.service';
import { AggregateRepository } from './aggregate.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEvent])],
  providers: [EventStoreService, UlidService, AggregateRepository],
  exports: [EventStoreService, UlidService, AggregateRepository],
})
export class EventStoreModule {}
