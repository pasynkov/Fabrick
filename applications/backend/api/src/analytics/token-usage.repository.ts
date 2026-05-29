import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository as TypeOrmRepository } from 'typeorm';
import { TokenUsage } from '../entities/token-usage.entity';

export interface CreateTokenUsageInput {
  projectId: string;
  searchRequestId: string | null;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
}

@Injectable()
export class TokenUsageRepository {
  constructor(
    @InjectRepository(TokenUsage)
    private readonly repo: TypeOrmRepository<TokenUsage>,
  ) {}

  async create(input: CreateTokenUsageInput): Promise<TokenUsage> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async findRecentForProject(projectId: string): Promise<TokenUsage[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.repo.find({
      where: { projectId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
    });
  }
}
