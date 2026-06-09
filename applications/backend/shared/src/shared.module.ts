import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SynthesisImpl } from './synthesis/synthesis.impl';
import { SearchImpl } from './search/search.impl';
import { SearchImplV2 } from './v2-search/search-impl-v2';

export interface SharedV2Providers {
  compendium: Provider;
  dossier: Provider;
}

@Module({})
export class SharedModule {
  static for(providers: { wiki: Provider; prompt: Provider }): DynamicModule {
    return {
      module: SharedModule,
      providers: [SynthesisImpl, SearchImpl, providers.wiki, providers.prompt],
      exports: [SynthesisImpl, SearchImpl],
    };
  }

  static forV2(providers: { compendium: Provider; dossier: Provider; prompt: Provider }): DynamicModule {
    return {
      module: SharedModule,
      providers: [SearchImplV2, providers.compendium, providers.dossier, providers.prompt],
      exports: [SearchImplV2],
    };
  }
}
