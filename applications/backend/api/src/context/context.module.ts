import { Module } from '@nestjs/common';
import { MinioModule } from '../minio/minio.module';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';

@Module({
  imports: [MinioModule],
  controllers: [ContextController],
  providers: [ContextService],
})
export class ContextModule {}
