import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgMember } from '../entities/org-member.entity';

@Injectable()
export class IsAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    const orgId: string | undefined = request.params?.orgId;

    if (!orgId) {
      throw new BadRequestException('Organization context could not be determined');
    }

    const member = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }
    if (member.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
