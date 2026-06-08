import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Project } from '../../../entities/project.entity';
import { Compendium } from '../compendium.aggregate';
import { CompendiumPagesRepository } from '../services/compendium-pages.repository';
import { CompendiumBundleService } from '../services/compendium-bundle.service';
import { UlidService } from '../../event-store/ulid.service';
import { AggregateRepository } from '../../event-store/aggregate.repository';
import { ProcessCompendiumResultCommand } from '../commands/process-compendium-result.command';

@CommandHandler(ProcessCompendiumResultCommand)
export class ProcessCompendiumResultHandler implements ICommandHandler<ProcessCompendiumResultCommand> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    private readonly eventPublisher: EventPublisher,
    private readonly ulidService: UlidService,
    private readonly compendiumPagesRepo: CompendiumPagesRepository,
    private readonly bundleService: CompendiumBundleService,
    private readonly aggregateRepo: AggregateRepository,
  ) {}

  async execute(command: ProcessCompendiumResultCommand): Promise<{ compendiumUpdatedId: string }> {
    const project = await this.projectRepo.findOne({ where: { id: command.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const compendium = this.eventPublisher.mergeObjectContext(
      new Compendium(command.projectId, command.orgId, this.ulidService),
    );

    const compendiumUpdatedId = compendium.acceptResult(command.jobId, command.result);

    await this.aggregateRepo.persist(compendium);

    await this.compendiumPagesRepo.upsertAll(
      command.orgId,
      command.projectId,
      command.result.finalCompendium.pages,
    );

    compendium.commit();

    await this.bundleService.deleteBoth(command.inputRef, command.resultRef);

    return { compendiumUpdatedId };
  }
}
