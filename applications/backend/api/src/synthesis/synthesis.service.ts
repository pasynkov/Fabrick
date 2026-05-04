import { ConflictException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { QueueService } from '../queue/queue.interface';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { StorageService } from '../storage/storage.service';
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

@Injectable()
export class SynthesisService {
  private readonly logger = new Logger(SynthesisService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  async triggerForProject(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    await this.requireOrgMember(userId, project.orgId);

    if (project.synthStatus === 'running') {
      throw new ConflictException('Synthesis already running');
    }

    const org = await this.orgRepo.findOne({ where: { id: project.orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const repos = await this.repoRepo.find({ where: { projectId } });

    const resolution = await this.apiKeyResolutionService.resolveForProject(projectId);
    const anthropicApiKey = resolution.apiKey;
    await this.apiKeyAuditService.logApiKeyUsage(resolution);

    const callbackToken = this.jwtService.sign(
      { sub: projectId, scope: 'synth-callback' },
      { expiresIn: '1h' },
    );

    await this.projectRepo.update(projectId, { synthStatus: 'running', synthError: null });
    this.logger.log(`[${project.slug}] synthesis triggered by user ${userId}`);

    await this.queueService.publish('synthesis-jobs', {
      projectId,
      orgSlug: org.slug,
      projectSlug: project.slug,
      repos: repos.map((r) => ({ id: r.id, slug: r.slug })),
      callbackToken,
      anthropicApiKey,
    });
  }

  async updateStatusFromCallback(
    token: string,
    projectId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    let payload: { sub: string; scope: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid callback token');
    }
    if (payload.scope !== 'synth-callback' || payload.sub !== projectId) {
      throw new UnauthorizedException('Invalid callback token');
    }
    await this.projectRepo.update(projectId, {
      synthStatus: status,
      synthError: error ?? null,
    });
  }

  async getStatus(projectId: string, userId: string): Promise<{ status: string; error?: string }> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.requireOrgMember(userId, project.orgId);
    const result: { status: string; error?: string } = { status: project.synthStatus };
    if (project.synthError) result.error = project.synthError;
    return result;
  }

  async getFiles(projectId: string, userId: string): Promise<Record<string, string>> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['org'],
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.requireOrgMember(userId, project.orgId);

    const orgSlug = (project as any).org.slug;
    const prefix = `${project.slug}/synthesis/`;
    const keys = await this.storageService.listObjects(orgSlug, prefix);

    const files: Record<string, string> = {};
    for (const key of keys) {
      const buf = await this.storageService.getObject(orgSlug, key);
      const relativePath = key.slice(prefix.length);
      files[relativePath] = buf.toString('utf-8');
    }
    return files;
  }

  async getSynthesisFileBySlug(userId: string, orgSlug: string, projectSlug: string, filePath: string): Promise<string> {
    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Project not found');

    await this.requireOrgMember(userId, org.id);

    const project = await this.projectRepo.findOne({ where: { orgId: org.id, slug: projectSlug } });
    if (!project) throw new NotFoundException('Project not found');

    const key = `${project.slug}/synthesis/${filePath}`;
    const buf = await this.storageService.getObject(orgSlug, key);
    return buf.toString('utf-8');
  }

  private async requireOrgMember(userId: string, orgId: string): Promise<void> {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new NotFoundException('Project not found');
  }
}
