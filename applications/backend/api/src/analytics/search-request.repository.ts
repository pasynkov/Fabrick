import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository as TypeOrmRepository } from 'typeorm';
import { SearchRequest } from '../entities/search-request.entity';
import { ANALYTICS_WINDOW_MS } from './analytics.constants';

export interface CreateSearchRequestInput {
  projectId: string;
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
  promptRevisionId?: string | null;
}

@Injectable()
export class SearchRequestRepository {
  constructor(
    @InjectRepository(SearchRequest)
    private readonly repo: TypeOrmRepository<SearchRequest>,
  ) {}

  async create(input: CreateSearchRequestInput): Promise<SearchRequest> {
    return this.repo.save(this.repo.create(input));
  }

  async findRecentForProject(projectId: string): Promise<SearchRequest[]> {
    return this.repo.find({
      where: { projectId, createdAt: MoreThanOrEqual(new Date(Date.now() - ANALYTICS_WINDOW_MS)) },
      order: { createdAt: 'DESC' },
    });
  }
}
