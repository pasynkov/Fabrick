import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { SearchRequest } from '../entities/search-request.entity';
import { TokenUsage } from '../entities/token-usage.entity';
import { SearchRequestRepository } from './search-request.repository';
import { TokenUsageRepository } from './token-usage.repository';

export interface SearchRequestRow {
  id: string;
  question: string;
  reasoningRequested: boolean;
  iters: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  stopReason: string;
  answerBrief: string;
  answerReasoning: string | null;
  sources: string[];
  createdAt: string;
}

export interface TokenUsageRow {
  id: string;
  searchRequestId: string | null;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  createdAt: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    private readonly searchRequestRepository: SearchRequestRepository,
    private readonly tokenUsageRepository: TokenUsageRepository,
  ) {}

  async getUsageForProject(
    projectId: string,
  ): Promise<{ searchRequests: SearchRequestRow[]; tokenUsage: TokenUsageRow[] }> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const [searchRequests, tokenUsage] = await Promise.all([
      this.searchRequestRepository.findRecentForProject(projectId),
      this.tokenUsageRepository.findRecentForProject(projectId),
    ]);

    return {
      searchRequests: searchRequests.map(toSearchRequestRow),
      tokenUsage: tokenUsage.map(toTokenUsageRow),
    };
  }
}

function toSearchRequestRow(r: SearchRequest): SearchRequestRow {
  const { project, projectId, createdAt, ...rest } = r;
  return { ...rest, createdAt: createdAt.toISOString() };
}

function toTokenUsageRow(r: TokenUsage): TokenUsageRow {
  const { project, searchRequest, projectId, createdAt, ...rest } = r;
  return { ...rest, createdAt: createdAt.toISOString() };
}
