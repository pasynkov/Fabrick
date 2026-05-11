import { ConflictException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository as TypeOrmRepository } from 'typeorm';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { QueueService } from '../queue/queue.interface';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { WikiPage } from '../entities/wiki-page.entity';
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

export interface WikiPageInput {
  slug: string;
  category: string;
  title: string;
  content: string;
  sources: string[];
  related: string[];
}

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
    @InjectRepository(WikiPage)
    private readonly wikiPageRepo: TypeOrmRepository<WikiPage>,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly jwtService: JwtService,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  async triggerForProject(projectId: string, userId: string, changedRepos?: string[]): Promise<void> {
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
      changedRepos: changedRepos ?? repos.map((r) => r.slug),
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
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.requireOrgMember(userId, project.orgId);

    const pages = await this.wikiPageRepo.find({ where: { projectId } });
    const files: Record<string, string> = {};
    for (const page of pages) {
      files[page.slug] = page.content;
    }
    return files;
  }

  async getSynthesisFileBySlug(userId: string, orgSlug: string, projectSlug: string, slug: string): Promise<string> {
    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Project not found');

    await this.requireOrgMember(userId, org.id);

    const project = await this.projectRepo.findOne({ where: { orgId: org.id, slug: projectSlug } });
    if (!project) throw new NotFoundException('Project not found');

    const page = await this.wikiPageRepo.findOne({ where: { projectId: project.id, slug } });
    if (!page) throw new NotFoundException('Page not found');
    return page.content;
  }

  // Internal endpoints for synthesis worker

  verifyCallbackToken(token: string, projectId: string): void {
    let payload: { sub: string; scope: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid callback token');
    }
    if (payload.scope !== 'synth-callback' || payload.sub !== projectId) {
      throw new UnauthorizedException('Invalid callback token');
    }
  }

  async upsertPages(projectId: string, pages: WikiPageInput[]): Promise<void> {
    for (const page of pages) {
      const existing = await this.wikiPageRepo.findOne({ where: { projectId, slug: page.slug } });
      if (existing) {
        await this.wikiPageRepo.update(
          { projectId, slug: page.slug },
          { category: page.category, title: page.title, content: page.content, sources: page.sources, related: page.related },
        );
      } else {
        await this.wikiPageRepo.save(
          this.wikiPageRepo.create({ projectId, slug: page.slug, category: page.category, title: page.title, content: page.content, sources: page.sources, related: page.related }),
        );
      }
    }
  }

  async getPagesByProject(projectId: string): Promise<WikiPage[]> {
    return this.wikiPageRepo.find({ where: { projectId } });
  }

  async deletePagesBySlugs(projectId: string, slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;
    await this.wikiPageRepo.delete({ projectId, slug: In(slugs) });
  }

  async getPublicPages(userId: string, orgSlug: string, projectSlug: string) {
    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Project not found');
    await this.requireOrgMember(userId, org.id);
    const project = await this.projectRepo.findOne({ where: { orgId: org.id, slug: projectSlug } });
    if (!project) throw new NotFoundException('Project not found');
    const pages = await this.wikiPageRepo.find({
      where: { projectId: project.id },
      select: ['id', 'slug', 'category', 'title', 'sources', 'related', 'updatedAt'],
    });
    return { pages };
  }

  private async requireOrgMember(userId: string, orgId: string): Promise<void> {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new NotFoundException('Project not found');
  }
}
