import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { FabrickAuthGuard } from '../../auth/fabrick-auth.guard';
import { CompendiumPagesRepository } from './services/compendium-pages.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { OrgMember } from '../../entities/org-member.entity';
import { NotFoundException } from '@nestjs/common';

@Controller({ path: 'projects', version: '2' })
export class CompendiumController {
  constructor(
    private readonly compendiumPagesRepo: CompendiumPagesRepository,
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
  ) {}

  @Get(':projectId/compendium')
  @UseGuards(FabrickAuthGuard)
  async getCompendium(@Param('projectId') projectId: string, @Request() req: any) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Not found');

    const member = await this.memberRepo.findOne({
      where: { orgId: project.orgId, userId: req.user.id },
    });
    if (!member) throw new NotFoundException('Not found');

    const pages = await this.compendiumPagesRepo.findByProject(projectId);
    return {
      pages: pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        content: p.content,
        sources: p.sources,
        related: p.related,
        frontmatter: p.frontmatter,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }
}
