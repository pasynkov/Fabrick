import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { ApiKeyAuditLevel } from '../entities/api-key-audit-log.entity';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { ApiKeyAuditService, AuditContext } from '../api-keys/api-key-audit.service';
import { ApiKeyEncryptionService } from '../api-keys/api-key-encryption.service';
import { ApiKeyValidationService } from '../api-keys/api-key-validation.service';
import { normalizeGitRemote, slugFromRemote } from './git-remote.util';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ReposService {
  private readonly logger = new Logger(ReposService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly apiKeyEncryptionService: ApiKeyEncryptionService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  async createProject(userId: string, orgId: string, name: string) {
    await this.requireOrgMember(userId, orgId);
    const slug = this.toSlug(name);
    const existing = await this.projectRepo.findOne({ where: { orgId, slug } });
    if (existing) throw new ConflictException('Project slug exists in this org');
    const project = await this.projectRepo.save(
      this.projectRepo.create({ name, slug, orgId }),
    );
    return { id: project.id, name: project.name, slug: project.slug, orgId };
  }

  async listProjects(userId: string, orgId: string) {
    await this.requireOrgMember(userId, orgId);
    const projects = await this.projectRepo.find({ where: { orgId } });
    return projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }));
  }

  async createRepo(userId: string, projectId: string, name: string, gitRemote: string) {
    const project = await this.getProjectOrFail(projectId);
    await this.requireOrgMember(userId, project.orgId);
    const normalized = normalizeGitRemote(gitRemote);
    const existing = await this.repoRepo.findOne({ where: { gitRemote: normalized } });
    if (existing) throw new ConflictException('Git remote already registered');
    const slug = slugFromRemote(normalized);
    const repo = await this.repoRepo.save(
      this.repoRepo.create({ name, slug, gitRemote: normalized, projectId }),
    );
    return { id: repo.id, name: repo.name, slug: repo.slug, gitRemote: repo.gitRemote, projectId };
  }

  async listRepos(userId: string, projectId: string) {
    const project = await this.getProjectOrFail(projectId);
    await this.requireOrgMember(userId, project.orgId);
    const repos = await this.repoRepo.find({ where: { projectId } });
    return repos.map((r) => ({ id: r.id, name: r.name, slug: r.slug, gitRemote: r.gitRemote }));
  }

  async findOrCreateRepo(userId: string, gitRemote: string, projectId: string) {
    const normalized = normalizeGitRemote(gitRemote);
    const project = await this.getProjectOrFail(projectId);
    await this.requireOrgMember(userId, project.orgId);

    const existing = await this.repoRepo.findOne({ where: { gitRemote: normalized } });
    if (existing) {
      return { status: 200, repo: { id: existing.id, name: existing.name, slug: existing.slug, gitRemote: existing.gitRemote, projectId: existing.projectId } };
    }

    const slug = slugFromRemote(normalized);
    const repo = await this.repoRepo.save(
      this.repoRepo.create({ name: slug, slug, gitRemote: normalized, projectId }),
    );
    return { status: 201, repo: { id: repo.id, name: repo.name, slug: repo.slug, gitRemote: repo.gitRemote, projectId } };
  }

  async getRepoWithContext(repoId: string): Promise<{
    repo: Repository;
    orgSlug: string;
    projectSlug: string;
  }> {
    const repo = await this.repoRepo.findOne({
      where: { id: repoId },
      relations: ['project', 'project.org'],
    });
    if (!repo) throw new NotFoundException('Repository not found');
    return {
      repo,
      orgSlug: (repo.project as any).org.slug,
      projectSlug: (repo.project as any).slug,
    };
  }

  async requireOrgMember(userId: string, orgId: string) {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException();
  }

  async requireOrgAdmin(userId: string, orgId: string) {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m || m.role !== 'admin') throw new ForbiddenException();
  }

  async updateProject(orgId: string, projectId: string, dto: UpdateProjectDto, userId: string, context: AuditContext) {
    await this.requireOrgAdmin(userId, orgId);
    const project = await this.getProjectOrFail(projectId);
    if (project.orgId !== orgId) throw new ForbiddenException();

    const updates: Partial<Project> = {};

    if (dto.name !== undefined) {
      if (!dto.name || dto.name.length === 0) throw new BadRequestException('Name must not be empty');
      const oldName = project.name;
      updates.name = dto.name;
      this.logger.log(`Project ${projectId} name changed from "${oldName}" to "${dto.name}" by user ${userId}`);
    }

    if (dto.anthropicApiKey !== undefined) {
      if (dto.anthropicApiKey === null) {
        if (project.anthropicApiKey) {
          let keyHash: string;
          try {
            const decryptedKey = this.apiKeyEncryptionService.decrypt(project.anthropicApiKey);
            keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);
          } catch {
            keyHash = 'decrypt-failed';
          }
          await this.apiKeyAuditService.logApiKeyDelete(ApiKeyAuditLevel.PROJECT, projectId, keyHash, context);
        }
        updates.anthropicApiKey = null;
      } else {
        const validation = this.apiKeyValidationService.validateFormat(dto.anthropicApiKey);
        if (!validation.isValid) {
          await this.apiKeyAuditService.logValidationFailure(ApiKeyAuditLevel.PROJECT, projectId, validation.errors, context);
          throw new BadRequestException(validation.errors);
        }
        const isUpdate = !!project.anthropicApiKey;
        updates.anthropicApiKey = this.apiKeyEncryptionService.encrypt(dto.anthropicApiKey);
        await this.apiKeyAuditService.logApiKeySet(ApiKeyAuditLevel.PROJECT, projectId, dto.anthropicApiKey, isUpdate, context);
      }
    }

    await this.projectRepo.update(projectId, updates);

    return {
      id: projectId,
      name: updates.name ?? project.name,
      slug: project.slug,
      orgId: project.orgId,
      hasApiKey: updates.anthropicApiKey !== undefined
        ? updates.anthropicApiKey !== null
        : !!project.anthropicApiKey,
    };
  }

  async updateProjectName(orgId: string, projectId: string, name: string, userId: string) {
    return this.updateProject(orgId, projectId, { name }, userId, { userId });
  }

  async getProjectApiKeyStatus(projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['org'],
    });
    if (!project) throw new NotFoundException('Project not found');

    const org = (project as any).org;
    const hasProjectApiKey = !!project.anthropicApiKey;
    const hasOrgApiKey = !!(org && org.anthropicApiKey);

    let effectiveSource: 'project' | 'organization' | 'none' = 'none';
    if (hasProjectApiKey) effectiveSource = 'project';
    else if (hasOrgApiKey) effectiveSource = 'organization';

    return {
      hasProjectApiKey,
      hasOrgApiKey,
      effectiveSource,
      keyHashes: {
        project: project.anthropicApiKey
          ? this.apiKeyEncryptionService.generateKeyHash(
              this.apiKeyEncryptionService.decrypt(project.anthropicApiKey),
            )
          : undefined,
        organization: org?.anthropicApiKey
          ? this.apiKeyEncryptionService.generateKeyHash(
              this.apiKeyEncryptionService.decrypt(org.anthropicApiKey),
            )
          : undefined,
      },
    };
  }

  async requireOrgMemberByRepo(userId: string, repoId: string) {
    const { repo } = await this.getRepoWithContext(repoId);
    await this.requireOrgMember(userId, (repo.project as any).orgId);
  }

  private async getProjectOrFail(projectId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63);
  }
}
