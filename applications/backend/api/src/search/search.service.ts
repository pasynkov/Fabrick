import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { SearchImpl } from '@app/shared';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { OrgMember } from '../entities/org-member.entity';
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';
import { SearchRequestRepository } from '../analytics/search-request.repository';
import { TokenUsageRepository } from '../analytics/token-usage.repository';

export interface SearchResponse {
  answer: string;
  reasoning?: string;
  sources: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly searchImpl: SearchImpl,
    private readonly searchRequestRepository: SearchRequestRepository,
    private readonly tokenUsageRepository: TokenUsageRepository,
  ) {}

  async search(
    userId: string,
    orgSlug: string,
    projectSlug: string,
    question: string,
    reasoning?: boolean,
  ): Promise<SearchResponse> {
    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException('Project not found');

    const member = await this.memberRepo.findOne({ where: { orgId: org.id, userId } });
    if (!member) throw new NotFoundException('Project not found');

    const project = await this.projectRepo.findOne({ where: { orgId: org.id, slug: projectSlug } });
    if (!project) throw new NotFoundException('Project not found');

    const resolution = await this.apiKeyResolutionService.resolveForProject(project.id);
    if (!resolution.apiKey) {
      throw new BadRequestException('No Anthropic API key configured. Set one in project or organization settings.');
    }

    const reasoningRequested = reasoning === true;

    let result: Awaited<ReturnType<SearchImpl['search']>>;
    try {
      result = await this.searchImpl.search(project.id, question, resolution.apiKey, {
        reasoning: reasoningRequested,
      });
    } catch (err: any) {
      if (err.message?.includes('No wiki pages found')) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.persistAnalytics(project.id, question, reasoningRequested, result);

    const response: SearchResponse = { answer: result.answer, sources: result.sources };
    if (result.reasoning !== undefined) response.reasoning = result.reasoning;
    return response;
  }

  private async persistAnalytics(
    projectId: string,
    question: string,
    reasoningRequested: boolean,
    result: Awaited<ReturnType<SearchImpl['search']>>,
  ): Promise<void> {
    let searchRequestId: string | null = null;
    try {
      const row = await this.searchRequestRepository.create({
        projectId,
        question,
        reasoningRequested,
        iters: result.metrics.iters,
        pagesRead: result.metrics.pagesRead,
        totalInputTokens: result.metrics.totalInputTokens,
        totalOutputTokens: result.metrics.totalOutputTokens,
        durationMs: result.metrics.durationMs,
        stopReason: result.metrics.stopReason,
        answerBrief: result.answer,
        answerReasoning: result.reasoning ?? null,
        sources: result.sources,
      });
      searchRequestId = row.id;
    } catch (err: any) {
      this.logger.error(`failed to insert search_requests row: ${err?.message ?? err}`);
    }

    for (const call of result.metrics.perCallTokens) {
      if (call.inputTokens === 0 && call.outputTokens === 0) continue;
      try {
        await this.tokenUsageRepository.create({
          projectId,
          searchRequestId,
          operation: 'search',
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          provider: 'claude',
        });
      } catch (err: any) {
        this.logger.error(`failed to insert token_usage row: ${err?.message ?? err}`);
      }
    }
  }
}
