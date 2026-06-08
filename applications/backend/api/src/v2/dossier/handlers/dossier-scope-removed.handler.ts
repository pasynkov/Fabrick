import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DossierScopeRemoved } from '../events/dossier-scope-removed.event';
import { DossierPagesRepository } from '../services/dossier-pages.repository';

@EventsHandler(DossierScopeRemoved)
export class DossierScopeRemovedHandler implements IEventHandler<DossierScopeRemoved> {
  constructor(private readonly dossierPagesRepo: DossierPagesRepository) {}

  async handle(event: DossierScopeRemoved): Promise<void> {
    if (!event.repoId || !event.scope) return;
    await this.dossierPagesRepo.deleteScope(event.repoId, event.scope);
  }
}
