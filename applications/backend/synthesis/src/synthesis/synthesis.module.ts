import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisProcessor } from './synthesis.processor';
import { SynthesisImpl, WIKI_REPOSITORY, PROMPT_REPOSITORY } from '@app/shared';
import { HttpPromptRepository } from '../http-prompt.repository';

// Stub wiki repository — synthesis worker does not use SearchImpl
const stubWikiProvider = {
  provide: WIKI_REPOSITORY,
  useValue: {},
};

@Module({
  imports: [QueueModule, StorageModule],
  providers: [
    SynthesisProcessor,
    SynthesisImpl,
    HttpPromptRepository,
    { provide: PROMPT_REPOSITORY, useExisting: HttpPromptRepository },
    stubWikiProvider,
  ],
})
export class SynthesisModule {}
