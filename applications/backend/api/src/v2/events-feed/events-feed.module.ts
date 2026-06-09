import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { Organization } from '../../entities/organization.entity';
import { Project } from '../../entities/project.entity';
import { Repository } from '../../entities/repository.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { ProjectEvent } from '../entities/project-event.entity';
import { EventsFeedController } from './events-feed.controller';
import { ListProjectEventsHandler } from './queries/list-project-events.handler';
import { GetProjectEventWithChildrenHandler } from './queries/get-project-event-with-children.handler';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ProjectEvent, Organization, Project, Repository, OrgMember]),
    AuthModule,
  ],
  controllers: [EventsFeedController],
  providers: [ListProjectEventsHandler, GetProjectEventWithChildrenHandler],
})
export class EventsFeedModule {}
