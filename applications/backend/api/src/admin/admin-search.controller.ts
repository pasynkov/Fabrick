import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { SearchRequest } from '../entities/search-request.entity';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller({ path: 'admin/search-requests', version: '1' })
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminSearchController {
  constructor(
    @InjectRepository(SearchRequest)
    private readonly searchRequestRepo: Repository<SearchRequest>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  @Get()
  async list(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('orgId') orgId?: string,
    @Query('projectId') projectId?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 500);
    const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);

    const qb = this.searchRequestRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.project', 'project')
      .leftJoinAndSelect('project.org', 'org')
      .orderBy('sr.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (projectId) {
      qb.andWhere('sr.projectId = :projectId', { projectId });
    }

    if (orgId) {
      qb.andWhere('project.orgId = :orgId', { orgId });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((sr) => ({
        id: sr.id,
        projectId: sr.projectId,
        projectName: sr.project?.name ?? null,
        orgName: sr.project?.org?.name ?? null,
        question: sr.question,
        reasoningRequested: sr.reasoningRequested,
        iters: sr.iters,
        pagesRead: sr.pagesRead,
        totalInputTokens: sr.totalInputTokens,
        totalOutputTokens: sr.totalOutputTokens,
        durationMs: sr.durationMs,
        stopReason: sr.stopReason,
        answerBrief: sr.answerBrief,
        answerReasoning: sr.answerReasoning,
        sources: sr.sources,
        createdAt: sr.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }
}
