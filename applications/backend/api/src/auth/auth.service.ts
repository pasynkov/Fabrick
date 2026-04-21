import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrgMember)
    private readonly orgMemberRepo: Repository<OrgMember>,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({ email, passwordHash }),
    );

    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const uniqueSlug = await this.uniqueSlug(slug);
    const org = await this.orgRepo.save(
      this.orgRepo.create({ name: email.split('@')[0], slug: uniqueSlug }),
    );
    await this.orgMemberRepo.save(
      this.orgMemberRepo.create({ orgId: org.id, userId: user.id, role: 'admin' }),
    );
    const access_token = this.signJwt(user);
    return { access_token, user: { id: user.id, email: user.email } };
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException();
    return { access_token: this.signJwt(user), user: { id: user.id, email: user.email } };
  }

  async issueCliToken(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const jwt = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'cli' },
      { expiresIn: '1y' },
    );
    return { token: `fbrk_${jwt}` };
  }

  async issueMcpToken(userId: string, orgSlug: string, projectSlug: string, repoId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const org = await this.orgRepo.findOne({ where: { slug: orgSlug } });
    if (!org) throw new ForbiddenException('Organization not found');

    const membership = await this.orgMemberRepo.findOne({
      where: { orgId: org.id, userId },
    });
    if (!membership) throw new ForbiddenException('Not a member of this organization');

    const jwt = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'mcp', org: orgSlug, project: projectSlug, repo: repoId },
      { expiresIn: '1y' },
    );
    return { token: `fbrk_${jwt}` };
  }

  private signJwt(user: User) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base.slice(0, 63);
    if (slug.length < 3) slug = slug.padEnd(3, '0');
    const existing = await this.orgRepo.findOne({ where: { slug } });
    if (!existing) return slug;
    const suffix = randomBytes(2).toString('hex');
    return `${slug.slice(0, 59)}-${suffix}`;
  }
}
