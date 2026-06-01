import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SynthesisImpl } from './synthesis/synthesis.impl';
import { SearchImpl } from './search/search.impl';

@Module({})
export class SharedModule {
  static for(providers: { wiki: Provider; prompt: Provider }): DynamicModule {
    return {
      module: SharedModule,
      providers: [SynthesisImpl, SearchImpl, providers.wiki, providers.prompt],
      exports: [SynthesisImpl, SearchImpl],
    };
  }
}
