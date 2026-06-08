import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';
import { ApiKeysModule } from '../../api-keys/api-keys.module';
import { QueueModule } from '../../queue/queue.module';
import { Repository } from '../../entities/repository.entity';
import { Project } from '../../entities/project.entity';
import { Organization } from '../../entities/organization.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { CompendiumPage } from '../entities/compendium-page.entity';
import { DossierPage } from '../entities/dossier-page.entity';
import { EventStoreModule } from '../event-store/event-store.module';
import { CompendiumController } from './compendium.controller';
import { CompendiumInternalController } from './compendium-internal.controller';
import { DossierUpdatedHandler } from './handlers/dossier-updated.handler';
import { ProcessCompendiumResultHandler } from './handlers/process-compendium-result.handler';
import { CompendiumJwtService } from './services/compendium-jwt.service';
import { CompendiumBundleService } from './services/compendium-bundle.service';
import { CompendiumPagesRepository } from './services/compendium-pages.repository';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([CompendiumPage, DossierPage, Repository, Project, Organization, OrgMember]),
    AuthModule,
    StorageModule,
    ApiKeysModule,
    QueueModule,
    EventStoreModule,
  ],
  controllers: [CompendiumController, CompendiumInternalController],
  providers: [
    DossierUpdatedHandler,
    ProcessCompendiumResultHandler,
    CompendiumJwtService,
    CompendiumBundleService,
    CompendiumPagesRepository,
  ],
})
export class CompendiumModule {}
