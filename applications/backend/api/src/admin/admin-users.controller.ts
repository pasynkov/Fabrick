import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgMember } from '../entities/org-member.entity';
import { User } from '../entities/user.entity';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller({ path: 'admin/users', version: '1' })
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminUsersController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
  ) {}

  @Get()
  async list(@Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 500);
    const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);

    const [items, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        isPlatformAdmin: u.isPlatformAdmin,
        createdAt: u.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const memberships = await this.memberRepo.find({
      where: { userId: id },
      relations: ['org'],
    });

    return {
      id: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt,
      organizations: memberships.map((m) => ({
        orgId: m.orgId,
        orgName: m.org?.name,
        orgSlug: m.org?.slug,
        role: m.role,
      })),
    };
  }
}
