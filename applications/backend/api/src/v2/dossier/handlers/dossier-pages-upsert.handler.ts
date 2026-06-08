import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DossierPatchApplied } from '../events/dossier-patch-applied.event';
import { DossierRegenApplied } from '../events/dossier-regen-applied.event';
import { DossierPagesRepository } from '../services/dossier-pages.repository';

@EventsHandler(DossierPatchApplied, DossierRegenApplied)
export class DossierPagesUpsertHandler implements IEventHandler<DossierPatchApplied | DossierRegenApplied> {
  constructor(private readonly dossierPagesRepo: DossierPagesRepository) {}

  async handle(event: DossierPatchApplied | DossierRegenApplied): Promise<void> {
    if (!event.bodies || !event.scope || !event.repoId || !event.projectId) return;
    await this.dossierPagesRepo.upsertChanged(
      event.orgId,
      event.projectId,
      event.repoId,
      event.scope,
      event.bodies,
    );
  }
}
