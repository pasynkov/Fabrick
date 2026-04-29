import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: Repository<OrgMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createOrg(userId: string, name: string) {
    const slug = this.toSlug(name);
    const existing = await this.orgRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Org slug already exists');
    const org = await this.orgRepo.save(this.orgRepo.create({ name, slug }));
    await this.memberRepo.save(
      this.memberRepo.create({ orgId: org.id, userId, role: 'admin' }),
    );
    return { id: org.id, name: org.name, slug: org.slug };
  }

  async listOrgs(userId: string) {
    const members = await this.memberRepo.find({
      where: { userId },
      relations: ['org'],
    });
    return members.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
    }));
  }

  async addMember(
    requestingUserId: string,
    orgId: string,
    email: string,
    password: string,
  ) {
    await this.requireAdmin(requestingUserId, orgId);

    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await this.userRepo.save(
        this.userRepo.create({ email, passwordHash }),
      );
    }

    const existing = await this.memberRepo.findOne({
      where: { orgId, userId: user.id },
    });
    if (existing) throw new ConflictException('User already a member');

    await this.memberRepo.save(
      this.memberRepo.create({ orgId, userId: user.id, role: 'member' }),
    );
    return { userId: user.id, email: user.email, role: 'member' };
  }

  async listMembers(requestingUserId: string, orgId: string) {
    await this.requireMember(requestingUserId, orgId);
    const members = await this.memberRepo.find({
      where: { orgId },
      relations: ['user'],
    });
    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: m.role,
    }));
  }

  async requireAdmin(userId: string, orgId: string) {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException();
    if (m.role !== 'admin') throw new ForbiddenException();
  }

  async requireMember(userId: string, orgId: string) {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException();
  }

  async updateOrgName(orgId: string, name: string, userId: string) {
    await this.requireAdmin(userId, orgId);
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');
    const oldName = org.name;
    org.name = name;
    await this.orgRepo.save(org);
    this.logger.log(`Org ${orgId} name changed from "${oldName}" to "${name}" by user ${userId}`);
    return { id: org.id, name: org.name, slug: org.slug };
  }

  async getOrgBySlug(slug: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { slug } });
    if (!org) throw new NotFoundException('Org not found');
    return org;
  }

  private toSlug(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63);
    return slug.length < 3 ? slug.padEnd(3, '0') : slug;
  }
}
