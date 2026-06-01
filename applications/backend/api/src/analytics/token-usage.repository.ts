import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository as TypeOrmRepository } from 'typeorm';
import { TokenUsage } from '../entities/token-usage.entity';
import { ANALYTICS_WINDOW_MS } from './analytics.constants';

export interface CreateTokenUsageInput {
  projectId: string;
  searchRequestId: string | null;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  promptRevisionId?: string | null;
}

@Injectable()
export class TokenUsageRepository {
  constructor(
    @InjectRepository(TokenUsage)
    private readonly repo: TypeOrmRepository<TokenUsage>,
  ) {}

  async create(input: CreateTokenUsageInput): Promise<TokenUsage> {
    return this.repo.save(this.repo.create(input));
  }

  async findRecentForProject(projectId: string): Promise<TokenUsage[]> {
    return this.repo.find({
      where: { projectId, createdAt: MoreThanOrEqual(new Date(Date.now() - ANALYTICS_WINDOW_MS)) },
      order: { createdAt: 'DESC' },
    });
  }
}
