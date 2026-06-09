import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../../analytics/analytics.module';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { AuthModule } from '../../auth/auth.module';
import { OrgMember } from '../../entities/org-member.entity';
import { Project } from '../../entities/project.entity';
import { Repository as RepositoryEntity } from '../../entities/repository.entity';
import { PromptsModule } from '../../prompts/prompts.module';
import { DbPromptRepository } from '../../prompts/db-prompt.repository';
import { CompendiumPage } from '../entities/compendium-page.entity';
import { DossierPage } from '../entities/dossier-page.entity';
import { COMPENDIUM_REPOSITORY, DOSSIER_REPOSITORY, PROMPT_REPOSITORY, SearchImplV2 } from '@app/shared';
import { SearchControllerV2 } from './search.controller.v2';
import { SearchServiceV2 } from './search.service.v2';
import { TypeOrmCompendiumSearchRepository } from './typeorm-compendium-search.repository';
import { TypeOrmDossierSearchRepository } from './typeorm-dossier-search.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, OrgMember, CompendiumPage, DossierPage, RepositoryEntity]),
    ApiKeysModule,
    AuthModule,
    AnalyticsModule,
    PromptsModule,
  ],
  controllers: [SearchControllerV2],
  providers: [
    SearchServiceV2,
    TypeOrmCompendiumSearchRepository,
    TypeOrmDossierSearchRepository,
    { provide: COMPENDIUM_REPOSITORY, useExisting: TypeOrmCompendiumSearchRepository },
    { provide: DOSSIER_REPOSITORY, useExisting: TypeOrmDossierSearchRepository },
    { provide: PROMPT_REPOSITORY, useExisting: DbPromptRepository },
    SearchImplV2,
  ],
})
export class SearchModuleV2 {}
