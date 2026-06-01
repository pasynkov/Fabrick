import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { SearchRequest } from '../entities/search-request.entity';
import { User } from '../entities/user.entity';
import { AdminOrgsController } from './admin-orgs.controller';
import { AdminProjectsController } from './admin-projects.controller';
import { AdminSearchController } from './admin-search.controller';
import { AdminUsersController } from './admin-users.controller';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrgMember, Project, Repository, SearchRequest]),
    AuthModule,
    AnalyticsModule,
  ],
  controllers: [
    AdminUsersController,
    AdminOrgsController,
    AdminProjectsController,
    AdminSearchController,
  ],
  providers: [PlatformAdminGuard],
})
export class AdminModule {}
