import { EventsHandler, EventPublisher, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Repository } from '../../../entities/repository.entity';
import { Project } from '../../../entities/project.entity';
import { Organization } from '../../../entities/organization.entity';
import { DossierUpdated } from '../../dossier/events/dossier-updated.event';
import { Compendium } from '../compendium.aggregate';
import { CompendiumBundleService } from '../services/compendium-bundle.service';
import { CompendiumJwtService } from '../services/compendium-jwt.service';
import { UlidService } from '../../event-store/ulid.service';
import { ApiKeyResolutionService } from '../../../api-keys/api-key-resolution.service';
import { ApiKeyAuditService } from '../../../api-keys/api-key-audit.service';
import { QUEUE_SERVICE } from '../../../queue/queue.module';
import { QueueService } from '../../../queue/queue.interface';

@EventsHandler(DossierUpdated)
export class DossierUpdatedHandler implements IEventHandler<DossierUpdated> {
  private readonly logger = new Logger(DossierUpdatedHandler.name);

  constructor(
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    private readonly bundleService: CompendiumBundleService,
    private readonly jwtService: CompendiumJwtService,
    private readonly ulidService: UlidService,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly eventPublisher: EventPublisher,
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

      const org = (project as any).org as Organization;
      const orgSlug = org.slug;
      const projectSlug = project.slug;

      const repos = await this.repoRepo.find({ where: { projectId: project.id } });
      const repoSlugs = repos.map((r) => r.slug);

      // Step 1-2: assemble + hash input bundle
      const { bundle, ref: bundleRef } = await this.bundleService.assembleInput(
        orgSlug,
        project.id,
        event.id,
      );

      // Step 3: upload bundle to Azure Blob
      await this.bundleService.upload(orgSlug, event.id, bundle);

      // Step 4: resolve API key + audit
      let anthropicApiKey: string;
      try {
        const resolution = await this.apiKeyResolutionService.resolveForProject(project.id);
        anthropicApiKey = resolution.apiKey;
        await this.apiKeyAuditService.logApiKeyUsage(resolution);
      } catch (err: any) {
        this.logger.warn(`DossierUpdatedHandler: no API key for project ${project.id}: ${err.message}`);
        anthropicApiKey = '';
      }

      // Step 5: sign callback JWT
      const callbackToken = this.jwtService.sign(event.id);

      // Step 6: fire Compendium regen
      const compendium = this.eventPublisher.mergeObjectContext(
        new Compendium(project.id, event.orgId, this.ulidService),
      );
      compendium.fireRegen(event.id, bundleRef, repoSlugs);
      compendium.commit();

      // Step 7: publish synthesis-jobs queue message
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
