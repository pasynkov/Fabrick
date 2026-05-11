import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisProcessor } from './synthesis.processor';
import { SharedModule } from '@app/shared';

@Module({
  imports: [QueueModule, StorageModule, SharedModule],
  providers: [SynthesisProcessor],
})
export class SynthesisModule {}
