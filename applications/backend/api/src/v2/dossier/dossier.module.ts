import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { DossierPage } from '../entities/dossier-page.entity';
import { Repository } from '../../entities/repository.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { EventStoreModule } from '../event-store/event-store.module';
import { DossierController } from './dossier.controller';
import { PushDossierUpdateHandler } from './handlers/push-dossier-update.handler';
import { DossierPagesRepository } from './services/dossier-pages.repository';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([DossierPage, Repository, OrgMember]),
    AuthModule,
    EventStoreModule,
  ],
  controllers: [DossierController],
  providers: [
    PushDossierUpdateHandler,
    DossierPagesRepository,
  ],
  exports: [DossierPagesRepository],
})
export class DossierModule {}
