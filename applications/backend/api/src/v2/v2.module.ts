import { Module } from '@nestjs/common';
import { EventStoreModule } from './event-store/event-store.module';
import { DossierModule } from './dossier/dossier.module';
import { CompendiumModule } from './compendium/compendium.module';
import { EventsFeedModule } from './events-feed/events-feed.module';

@Module({
  imports: [
    EventStoreModule,
    DossierModule,
    CompendiumModule,
    EventsFeedModule,
  ],
})
export class V2Module {}
