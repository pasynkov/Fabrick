import { Controller, Get, Param, Query, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { FabrickAuthGuard } from '../../auth/fabrick-auth.guard';
import { Organization } from '../../entities/organization.entity';
import { Project } from '../../entities/project.entity';
import { Repository } from '../../entities/repository.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { ListProjectEventsQuery } from './queries/list-project-events.query';
import { GetProjectEventWithChildrenQuery } from './queries/get-project-event-with-children.query';

@Controller({ version: '2' })
export class EventsFeedController {
  constructor(
    private readonly queryBus: QueryBus,
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
  ) {}

  @Get('orgs/:orgId/events')
  @UseGuards(FabrickAuthGuard)
  async getOrgEvents(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
  ) {
    const member = await this.memberRepo.findOne({ where: { orgId, userId: req.user.id } });
    if (!member) throw new NotFoundException('Not found');

    return this.queryBus.execute(
      new ListProjectEventsQuery({ orgId }, since, limit ? parseInt(limit, 10) : 50, types),
    );
  }

  @Get('projects/:projectId/events')
  @UseGuards(FabrickAuthGuard)
  async getProjectEvents(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
  ) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Not found');

    const member = await this.memberRepo.findOne({ where: { orgId: project.orgId, userId: req.user.id } });
    if (!member) throw new NotFoundException('Not found');

    return this.queryBus.execute(
      new ListProjectEventsQuery({ projectId }, since, limit ? parseInt(limit, 10) : 50, types),
    );
  }

  @Get('repos/:repoId/events')
  @UseGuards(FabrickAuthGuard)
  async getRepoEvents(
    @Param('repoId') repoId: string,
    @Request() req: any,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
  ) {
    const repo = await this.repoRepo.findOne({
      where: { id: repoId },
      relations: ['project'],
    });
    if (!repo) throw new NotFoundException('Not found');

    const project = (repo as any).project;
    const member = await this.memberRepo.findOne({ where: { orgId: project.orgId, userId: req.user.id } });
    if (!member) throw new NotFoundException('Not found');

    return this.queryBus.execute(
      new ListProjectEventsQuery({ repoId }, since, limit ? parseInt(limit, 10) : 50, types),
    );
  }

  @Get('repos/:repoId/events/:eventId')
  @UseGuards(FabrickAuthGuard)
  async getEventWithChildren(
    @Param('repoId') repoId: string,
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    const repo = await this.repoRepo.findOne({
      where: { id: repoId },
      relations: ['project'],
    });
    if (!repo) throw new NotFoundException('Not found');

    const project = (repo as any).project;
    const member = await this.memberRepo.findOne({ where: { orgId: project.orgId, userId: req.user.id } });
    if (!member) throw new NotFoundException('Not found');

    return this.queryBus.execute(new GetProjectEventWithChildrenQuery(repoId, eventId));
  }
}
