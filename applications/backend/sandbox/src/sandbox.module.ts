import { Module } from '@nestjs/common';
import { SharedModule, WIKI_REPOSITORY, PROMPT_REPOSITORY, COMPENDIUM_REPOSITORY, DOSSIER_REPOSITORY, SearchImplV2 } from '@app/shared';
import { FsWikiRepository } from './fs-wiki.repository';
import { FilePromptRepository } from './file-prompt.repository';
import { FsCompendiumRepository } from './fs-compendium.repository';
import { FsDossierRepository } from './fs-dossier.repository';
import { SandboxController } from './sandbox.controller';
import { SandboxV2Controller } from './sandbox-v2.controller';

@Module({
  imports: [
    SharedModule.for({
      wiki: { provide: WIKI_REPOSITORY, useClass: FsWikiRepository },
      prompt: { provide: PROMPT_REPOSITORY, useClass: FilePromptRepository },
    }),
  ],
  controllers: [SandboxController, SandboxV2Controller],
  providers: [
    FsWikiRepository,
    FilePromptRepository,
    FsCompendiumRepository,
    FsDossierRepository,
    { provide: COMPENDIUM_REPOSITORY, useExisting: FsCompendiumRepository },
    { provide: DOSSIER_REPOSITORY, useExisting: FsDossierRepository },
    { provide: PROMPT_REPOSITORY, useClass: FilePromptRepository },
    SearchImplV2,
  ],
})
export class SandboxModule {}
