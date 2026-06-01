import { Controller, Get, NotFoundException, Param, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { OrgMember } from '../entities/org-member.entity';
import { Project } from '../entities/project.entity';
import { AnalyticsService } from './analytics.service';

@Controller({ version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
  ) {}

  @Get('projects/:id/usage-analytics')
  @UseGuards(FabrickAuthGuard)
  async getUsage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    const member = await this.memberRepo.findOne({ where: { orgId: project.orgId, userId: req.user.id } });
    if (!member) throw new NotFoundException('Project not found');

    return this.analyticsService.getUsageForProject(id);
  }
}
