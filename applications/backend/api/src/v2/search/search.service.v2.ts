import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { SearchImplV2 } from '@app/shared';
import { Project } from '../../entities/project.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { ApiKeyResolutionService } from '../../api-keys/api-key-resolution.service';
import { SearchRequestRepository } from '../../analytics/search-request.repository';
import { TokenUsageRepository } from '../../analytics/token-usage.repository';

export interface SearchResponseV2 {
  answer: string;
  reasoning?: string;
  sources: string[];
}

@Injectable()
export class SearchServiceV2 {
  private readonly logger = new Logger(SearchServiceV2.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly searchImplV2: SearchImplV2,
    private readonly searchRequestRepository: SearchRequestRepository,
    private readonly tokenUsageRepository: TokenUsageRepository,
  ) {}

  async search(
    userId: string,
    projectId: string,
    question: string,
    reasoning?: boolean,
  ): Promise<SearchResponseV2> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const member = await this.memberRepo.findOne({ where: { orgId: project.orgId, userId } });
    if (!member) throw new NotFoundException('Project not found');

    let resolution: Awaited<ReturnType<typeof this.apiKeyResolutionService.resolveForProject>>;
    try {
      resolution = await this.apiKeyResolutionService.resolveForProject(projectId);
    } catch (err: any) {
      throw new BadRequestException('No Anthropic API key configured. Set one in project or organization settings.');
    }
    if (!resolution.apiKey) {
      throw new BadRequestException('No Anthropic API key configured. Set one in project or organization settings.');
    }

    const reasoningRequested = reasoning === true;

    let result: Awaited<ReturnType<SearchImplV2['search']>>;
    try {
      result = await this.searchImplV2.search(projectId, question, resolution.apiKey, {
        reasoning: reasoningRequested,
      });
    } catch (err: any) {
      if (err.message?.includes('No compendium index found')) {
        throw new BadRequestException('No compendium index found. Run compendium synthesis first.');
      }
      throw err;
    }

    await this.persistAnalytics(projectId, question, reasoningRequested, result);

    const response: SearchResponseV2 = { answer: result.answer, sources: result.sources };
    if (result.reasoning !== undefined) response.reasoning = result.reasoning;
    return response;
  }

  private async persistAnalytics(
    projectId: string,
    question: string,
    reasoningRequested: boolean,
    result: Awaited<ReturnType<SearchImplV2['search']>>,
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
        promptRevisionId: result.promptRevisionId ?? null,
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
          promptRevisionId: result.promptRevisionId ?? null,
        });
      } catch (err: any) {
        this.logger.error(`failed to insert token_usage row: ${err?.message ?? err}`);
      }
    }
  }
}
