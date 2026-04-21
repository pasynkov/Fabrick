import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisProcessor } from './synthesis.processor';

@Module({
  imports: [QueueModule, StorageModule],
  providers: [SynthesisProcessor],
})
export class SynthesisModule {}
