import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { Repository as RepoEntity } from '../entities/repository.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller({ path: 'admin/projects', version: '1' })
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminProjectsController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(RepoEntity)
    private readonly repoRepo: Repository<RepoEntity>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  async list(@Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 500);
    const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);

    const [projects, total] = await this.projectRepo.findAndCount({
      relations: ['org'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      items: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        orgId: p.orgId,
        orgName: p.org?.name,
        createdAt: p.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['org'],
    });
    if (!project) throw new NotFoundException('Project not found');

    const repos = await this.repoRepo.find({
      where: { projectId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      orgId: project.orgId,
      orgName: project.org?.name,
      createdAt: project.createdAt,
      repositories: repos.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        gitRemote: r.gitRemote,
        createdAt: r.createdAt,
      })),
    };
  }

  @Get(':id/usage')
  async usage(@Param('id') id: string) {
    return this.analyticsService.getUsageForProject(id);
  }
}
