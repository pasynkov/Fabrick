import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisProcessor } from './synthesis.processor';
import { SynthesisImpl } from '@app/shared';

@Module({
  imports: [QueueModule, StorageModule],
  providers: [SynthesisProcessor, SynthesisImpl],
})
export class SynthesisModule {}
