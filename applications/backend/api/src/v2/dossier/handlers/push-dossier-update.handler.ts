import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Repository } from '../../../entities/repository.entity';
import { OrgMember } from '../../../entities/org-member.entity';
import { UlidService } from '../../event-store/ulid.service';
import { EventStoreService } from '../../event-store/event-store.service';
import { Dossier } from '../dossier.aggregate';
import { PushDossierUpdateCommand } from '../commands/push-dossier-update.command';
import { DossierPagesRepository } from '../services/dossier-pages.repository';
import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';
import { DossierRegenApplied } from '../events/dossier-regen-applied.event';
import { DossierPatchApplied } from '../events/dossier-patch-applied.event';
import { DossierScopeRemoved } from '../events/dossier-scope-removed.event';

@CommandHandler(PushDossierUpdateCommand)
export class PushDossierUpdateHandler implements ICommandHandler<PushDossierUpdateCommand> {
  constructor(
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly eventPublisher: EventPublisher,
    private readonly ulidService: UlidService,
    private readonly eventStore: EventStoreService,
    private readonly dossierPagesRepo: DossierPagesRepository,
  ) {}

  async execute(command: PushDossierUpdateCommand): Promise<{ dossierUpdatedId: string }> {
    const repo = await this.repoRepo.findOne({
      where: { id: command.repoId },
      relations: ['project', 'project.org'],
    });
    if (!repo) throw new NotFoundException('Repository not found');

    const project = repo.project as any;
    const orgId: string = project.orgId;

    const member = await this.memberRepo.findOne({
      where: { orgId, userId: command.userId },
    });
    if (!member) throw new NotFoundException('Not found');

    const dossier = this.eventPublisher.mergeObjectContext(
      new Dossier(command.repoId, orgId, project.id, this.ulidService),
    );

    const dossierUpdatedId = dossier.applyPushUpdate(command.dto);

    // Persist events synchronously before returning so the HTTP response
    // reflects the completed state. EventBus handlers (side effects) run async.
    const uncommittedEvents = dossier.getUncommittedEvents() as BaseDomainEvent[];

    // Persist all events to event store
    await this.eventStore.persistBatch(uncommittedEvents.map((e) => e.toEntity()));

    // Apply page upserts/deletions synchronously
    for (const evt of uncommittedEvents) {
      if (evt instanceof DossierRegenApplied || evt instanceof DossierPatchApplied) {
        if (evt.bodies && evt.scope && evt.repoId && evt.projectId) {
          await this.dossierPagesRepo.upsertChanged(
            evt.orgId,
            evt.projectId,
            evt.repoId,
            evt.scope,
            evt.bodies,
          );
        }
      } else if (evt instanceof DossierScopeRemoved) {
        if (evt.repoId && evt.scope) {
          await this.dossierPagesRepo.deleteScope(evt.repoId, evt.scope);
        }
      }
    }

    // Commit to EventBus for async side effects (compendium cascade, etc.)
    dossier.commit();

    return { dossierUpdatedId };
  }
}
