import { Module } from '@nestjs/common';
import { EventStoreModule } from './event-store/event-store.module';
import { DossierModule } from './dossier/dossier.module';
import { CompendiumModule } from './compendium/compendium.module';
import { EventsFeedModule } from './events-feed/events-feed.module';
import { SearchModuleV2 } from './search/search.module.v2';

@Module({
  imports: [
    EventStoreModule,
    DossierModule,
    CompendiumModule,
    EventsFeedModule,
    SearchModuleV2,
  ],
})
export class V2Module {}
