import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PROMPT_REPOSITORY } from '@app/shared';
import { PromptRevision } from '../entities/prompt-revision.entity';
import { DbPromptRepository } from './db-prompt.repository';
import { PromptsController, InternalPromptsController } from './prompts.controller';
import { AuthModule } from '../auth/auth.module';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptRevision]),
    AuthModule,
  ],
  controllers: [PromptsController, InternalPromptsController],
  providers: [
    DbPromptRepository,
    { provide: PROMPT_REPOSITORY, useExisting: DbPromptRepository },
    PlatformAdminGuard,
  ],
  exports: [DbPromptRepository, PROMPT_REPOSITORY],
})
export class PromptsModule {}
