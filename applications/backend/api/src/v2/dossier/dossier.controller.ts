import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FabrickAuthGuard } from '../../auth/fabrick-auth.guard';
import { DossierPagesRepository } from './services/dossier-pages.repository';
import { PushDossierUpdateCommand } from './commands/push-dossier-update.command';
import { PushDossierUpdateDto } from './dto/push-dossier-update.dto';

@Controller({ path: 'repos', version: '2' })
export class DossierController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly dossierPagesRepo: DossierPagesRepository,
  ) {}

  @Post(':repoId/dossier/events')
  @UseGuards(FabrickAuthGuard)
  async pushDossierUpdate(
    @Param('repoId') repoId: string,
    @Body() dto: PushDossierUpdateDto,
    @Request() req: any,
  ): Promise<{ dossierUpdatedId: string }> {
    return this.commandBus.execute(
      new PushDossierUpdateCommand(repoId, req.user.id, dto),
    );
  }

  @Get(':repoId/dossier')
  @UseGuards(FabrickAuthGuard)
  async getDossier(@Param('repoId') repoId: string) {
    const pages = await this.dossierPagesRepo.findByRepo(repoId);

    const scopeMap = new Map<string, any[]>();
    for (const page of pages) {
      if (!scopeMap.has(page.scope)) scopeMap.set(page.scope, []);
      scopeMap.get(page.scope)!.push({
        slug: page.slug,
        title: page.title,
        content: page.content,
        sources: page.sources,
        related: page.related,
        frontmatter: page.frontmatter,
        updatedAt: page.updatedAt.toISOString(),
      });
    }

    const scopes = Array.from(scopeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([scope, p]) => ({ scope, pages: p }));

    return { scopes };
  }
}
