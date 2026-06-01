import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller({ path: 'admin/orgs', version: '1' })
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminOrgsController {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  @Get()
  async list(@Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 500);
    const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);

    const [items, total] = await this.orgRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      items: items.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const members = await this.memberRepo.find({
      where: { orgId: id },
      relations: ['user'],
    });

    const projects = await this.projectRepo.find({
      where: { orgId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.user?.email,
        role: m.role,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        createdAt: p.createdAt,
      })),
    };
  }
}
