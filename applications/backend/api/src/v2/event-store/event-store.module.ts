import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEvent } from '../entities/project-event.entity';
import { EventStoreService } from './event-store.service';
import { UlidService } from './ulid.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEvent])],
  providers: [EventStoreService, UlidService],
  exports: [EventStoreService, UlidService],
})
export class EventStoreModule {}
