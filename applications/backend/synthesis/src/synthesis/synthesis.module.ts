import { Module } from '@nestjs/common';
import { MinioModule } from '../minio/minio.module';
import { QueueModule } from '../queue/queue.module';
import { SynthesisProcessor } from './synthesis.processor';

@Module({
  imports: [QueueModule, MinioModule],
  providers: [SynthesisProcessor],
})
export class SynthesisModule {}
