import { EventsHandler, EventPublisher, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Project } from '../../../entities/project.entity';
import { DossierUpdated } from '../../dossier/events/dossier-updated.event';
import { Compendium } from '../compendium.aggregate';
import { CompendiumBundleService } from '../services/compendium-bundle.service';
import { CompendiumJwtService } from '../services/compendium-jwt.service';
import { UlidService } from '../../event-store/ulid.service';
import { AggregateRepository } from '../../event-store/aggregate.repository';
import { ApiKeyResolutionService } from '../../../api-keys/api-key-resolution.service';
import { ApiKeyAuditService } from '../../../api-keys/api-key-audit.service';
import { QUEUE_SERVICE } from '../../../queue/queue.module';
import { QueueService } from '../../../queue/queue.interface';

@EventsHandler(DossierUpdated)
export class DossierUpdatedHandler implements IEventHandler<DossierUpdated> {
  private readonly logger = new Logger(DossierUpdatedHandler.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    private readonly bundleService: CompendiumBundleService,
    private readonly jwtService: CompendiumJwtService,
    private readonly ulidService: UlidService,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly eventPublisher: EventPublisher,
    private readonly aggregateRepo: AggregateRepository,
  ) {}

  async handle(event: DossierUpdated): Promise<void> {
    try {
      const project = await this.projectRepo.findOne({
        where: { id: event.projectId! },
        relations: ['org'],
      });
      if (!project) {
        this.logger.warn(`DossierUpdatedHandler: project ${event.projectId} not found`);
        return;
      }

      const orgSlug = (project as any).org.slug;
      const projectSlug = project.slug;

      const { ref: bundleRef, repoSlugs } = await this.bundleService.assembleAndUpload(orgSlug, project.id, event.id);

      let anthropicApiKey: string;
      try {
        const resolution = await this.apiKeyResolutionService.resolveForProject(project.id);
        anthropicApiKey = resolution.apiKey;
        await this.apiKeyAuditService.logApiKeyUsage(resolution);
      } catch (err: any) {
        this.logger.warn(`DossierUpdatedHandler: no API key for project ${project.id}: ${err.message}`);
        anthropicApiKey = '';
      }

      const callbackToken = this.jwtService.sign(event.id);

      const compendium = this.eventPublisher.mergeObjectContext(
        new Compendium(project.id, event.orgId, this.ulidService),
      );
      compendium.fireRegen(event.id, bundleRef, repoSlugs);
      await this.aggregateRepo.persist(compendium);
      compendium.commit();

      await this.queueService.publish('synthesis-jobs', {
        type: 'compendium-event',
        jobId: event.id,
        projectId: project.id,
        orgSlug,
        projectSlug,
        bundleRef,
        anthropicApiKey,
        callbackToken,
      });
    } catch (err: any) {
      this.logger.error(`DossierUpdatedHandler failed: ${err.message}`, err.stack);
    }
  }
}
