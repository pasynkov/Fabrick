import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository as TypeOrmRepository } from 'typeorm';
import { SearchRequest } from '../entities/search-request.entity';

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
}

@Injectable()
export class SearchRequestRepository {
  constructor(
    @InjectRepository(SearchRequest)
    private readonly repo: TypeOrmRepository<SearchRequest>,
  ) {}

  async create(input: CreateSearchRequestInput): Promise<SearchRequest> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async findRecentForProject(projectId: string): Promise<SearchRequest[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.repo.find({
      where: { projectId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
    });
  }
}
