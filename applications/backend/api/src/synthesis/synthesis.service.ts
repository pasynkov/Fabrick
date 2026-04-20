import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository as TypeOrmRepository } from 'typeorm';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository } from '../entities/repository.entity';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class SynthesisService {
  private readonly logger = new Logger(SynthesisService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  private readonly systemPrompt: string;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly minioService: MinioService,
  ) {
    this.systemPrompt = readFileSync(
      join(__dirname, '..', 'assets', 'synthesis-prompt.txt'),
      'utf-8',
    );
  }

  async triggerForProject(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['org'],
    });
    if (!project) throw new NotFoundException('Project not found');

    await this.requireOrgMember(userId, project.orgId);

    if (project.synthStatus === 'running') {
      throw new ConflictException('Synthesis already running');
    }

    await this.projectRepo.update(projectId, { synthStatus: 'running', synthError: null });
    this.logger.log(`[${project.slug}] synthesis triggered by user ${userId}`);

    const orgSlug = (project as any).org.slug;
    this.runSynthesis(project, orgSlug).catch(() => {/* handled inside */});
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
    const keys = await this.minioService.listObjects(orgSlug, prefix);

    const files: Record<string, string> = {};
    for (const key of keys) {
      const buf = await this.minioService.getObject(orgSlug, key);
      const relativePath = key.slice(prefix.length);
      files[relativePath] = buf.toString('utf-8');
    }
    return files;
  }

  async runSynthesis(project: Project, orgSlug: string): Promise<void> {
    try {
      this.logger.log(`[${project.slug}] loading repos`);
      const repos = await this.repoRepo.find({ where: { projectId: project.id } });
      this.logger.log(`[${project.slug}] found ${repos.length} repos`);

      const contextBlocks: string[] = [];
      for (const repo of repos) {
        const prefix = `${project.slug}/${repo.slug}/context/`;
        this.logger.log(`[${project.slug}] listing context at ${orgSlug}/${prefix}`);
        const keys = await this.minioService.listObjects(orgSlug, prefix);
        this.logger.log(`[${project.slug}/${repo.slug}] ${keys.length} context files`);
        if (keys.length === 0) continue;

        let block = `=== REPO: ${repo.slug} ===\n`;
        for (const key of keys) {
          const fileName = key.slice(prefix.length);
          const content = await this.minioService.getObject(orgSlug, key);
          block += `--- ${fileName} ---\n${content.toString('utf-8')}\n`;
        }
        contextBlocks.push(block);
      }

      if (contextBlocks.length === 0) {
        this.logger.warn(`[${project.slug}] no context files found`);
        await this.projectRepo.update(project.id, {
          synthStatus: 'error',
          synthError: 'No context files found for any repository',
        });
        return;
      }

      const userMessage = contextBlocks.join('\n\n');
      this.logger.log(`[${project.slug}] calling Anthropic, input ~${userMessage.length} chars`);

      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const rawText = response.content.find((c) => c.type === 'text')?.text ?? '';
      this.logger.log(`[${project.slug}] Anthropic response ${rawText.length} chars, stop_reason=${response.stop_reason}`);
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Anthropic response truncated (max_tokens reached) — increase max_tokens or reduce context');
      }

      const text = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      let parsed: { files: Record<string, string> };
      try {
        parsed = JSON.parse(text);
      } catch (parseErr: any) {
        this.logger.error(`[${project.slug}] JSON parse failed: ${parseErr.message}`);
        this.logger.debug(`[${project.slug}] raw response (first 500): ${rawText.slice(0, 500)}`);
        throw new Error(`Claude returned non-JSON: ${parseErr.message}`);
      }

      const fileCount = Object.keys(parsed.files).length;
      this.logger.log(`[${project.slug}] parsed ${fileCount} synthesis files`);

      const synthPrefix = `${project.slug}/synthesis/`;
      for (const [path, content] of Object.entries(parsed.files)) {
        await this.minioService.putObject(
          orgSlug,
          `${synthPrefix}${path}`,
          Buffer.from(content, 'utf-8'),
        );
        this.logger.log(`[${project.slug}] stored ${path}`);
      }

      await this.projectRepo.update(project.id, { synthStatus: 'done', synthError: null });
      this.logger.log(`[${project.slug}] synthesis done`);
    } catch (err: any) {
      this.logger.error(`[${project.slug}] synthesis failed: ${err?.message}`);
      await this.projectRepo.update(project.id, {
        synthStatus: 'error',
        synthError: err?.message ?? 'Unknown error',
      });
    }
  }

  private async requireOrgMember(userId: string, orgId: string): Promise<void> {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new NotFoundException('Project not found');
  }
}
