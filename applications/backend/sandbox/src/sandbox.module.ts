import { Module } from '@nestjs/common';
import { SharedModule, WIKI_REPOSITORY, PROMPT_REPOSITORY } from '@app/shared';
import { FsWikiRepository } from './fs-wiki.repository';
import { FilePromptRepository } from './file-prompt.repository';
import { SandboxController } from './sandbox.controller';

@Module({
  imports: [
    SharedModule.for({
      wiki: { provide: WIKI_REPOSITORY, useClass: FsWikiRepository },
      prompt: { provide: PROMPT_REPOSITORY, useClass: FilePromptRepository },
    }),
  ],
  controllers: [SandboxController],
  providers: [FsWikiRepository, FilePromptRepository],
})
export class SandboxModule {}
