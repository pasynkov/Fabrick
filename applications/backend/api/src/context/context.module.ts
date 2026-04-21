import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ContextController } from './context.controller';
import { ContextService } from './context.service';

@Module({
  imports: [StorageModule],
  controllers: [ContextController],
  providers: [ContextService],
})
export class ContextModule {}
