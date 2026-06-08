import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EventStoreService } from '../event-store.service';
import { BaseDomainEvent } from '../domain/base-domain-event';

// Event classes are imported after creation - filled in at task 6.5
import { DossierUpdateFired } from '../../dossier/events/dossier-update-fired.event';
import { DossierPatchComputed } from '../../dossier/events/dossier-patch-computed.event';
import { DossierPatchApplied } from '../../dossier/events/dossier-patch-applied.event';
import { DossierPatchDescribed } from '../../dossier/events/dossier-patch-described.event';
import { DossierRegenApplied } from '../../dossier/events/dossier-regen-applied.event';
import { DossierRegenDescribed } from '../../dossier/events/dossier-regen-described.event';
import { DossierScopeRemoved } from '../../dossier/events/dossier-scope-removed.event';
import { DossierUpdated } from '../../dossier/events/dossier-updated.event';
import { CompendiumRegenFired } from '../../compendium/events/compendium-regen-fired.event';
import { CompendiumPatchComputed } from '../../compendium/events/compendium-patch-computed.event';
import { CompendiumRegenApplied } from '../../compendium/events/compendium-regen-applied.event';
import { CompendiumDescribed } from '../../compendium/events/compendium-described.event';
import { CompendiumUpdated } from '../../compendium/events/compendium-updated.event';

@EventsHandler(
  DossierUpdateFired,
  DossierPatchComputed,
  DossierPatchApplied,
  DossierPatchDescribed,
  DossierRegenApplied,
  DossierRegenDescribed,
  DossierScopeRemoved,
  DossierUpdated,
  CompendiumRegenFired,
  CompendiumPatchComputed,
  CompendiumRegenApplied,
  CompendiumDescribed,
  CompendiumUpdated,
)
export class PersistEventHandler implements IEventHandler<BaseDomainEvent> {
  constructor(private readonly eventStore: EventStoreService) {}

  async handle(event: BaseDomainEvent): Promise<void> {
    await this.eventStore.persist(event.toEntity());
  }
}
