import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SynthesisImpl } from './synthesis/synthesis.impl';
import { SearchImpl } from './search/search.impl';

@Module({})
export class SharedModule {
  static forRepository(repositoryProvider: Provider): DynamicModule {
    return {
      module: SharedModule,
      providers: [SynthesisImpl, SearchImpl, repositoryProvider],
      exports: [SynthesisImpl, SearchImpl],
    };
  }
}
