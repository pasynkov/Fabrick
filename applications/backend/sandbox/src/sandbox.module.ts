import { Module } from '@nestjs/common';
import { SharedModule, WIKI_REPOSITORY } from '@app/shared';
import { FsWikiRepository } from './fs-wiki.repository';
import { SandboxController } from './sandbox.controller';

@Module({
  imports: [
    SharedModule.forRepository({ provide: WIKI_REPOSITORY, useClass: FsWikiRepository }),
  ],
  controllers: [SandboxController],
  providers: [FsWikiRepository],
})
export class SandboxModule {}
