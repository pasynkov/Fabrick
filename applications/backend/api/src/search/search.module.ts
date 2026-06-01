import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { WikiPage } from '../entities/wiki-page.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TypeOrmWikiRepository } from './typeorm-wiki.repository';
import { SearchImpl, WIKI_REPOSITORY, PROMPT_REPOSITORY } from '@app/shared';
import { PromptsModule } from '../prompts/prompts.module';
import { DbPromptRepository } from '../prompts/db-prompt.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Project, WikiPage, OrgMember]),
    ApiKeysModule,
    AuthModule,
    AnalyticsModule,
    PromptsModule,
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    TypeOrmWikiRepository,
    { provide: WIKI_REPOSITORY, useExisting: TypeOrmWikiRepository },
    { provide: PROMPT_REPOSITORY, useExisting: DbPromptRepository },
    SearchImpl,
  ],
})
export class SearchModule {}
