import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { WikiPage } from '../entities/wiki-page.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TypeOrmWikiRepository } from './typeorm-wiki.repository';
import { SharedModule, WIKI_REPOSITORY } from '@app/shared';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Project, WikiPage, OrgMember]),
    ApiKeysModule,
    AuthModule,
    SharedModule.forRepository({ provide: WIKI_REPOSITORY, useExisting: TypeOrmWikiRepository }),
  ],
  controllers: [SearchController],
  providers: [SearchService, TypeOrmWikiRepository],
})
export class SearchModule {}
