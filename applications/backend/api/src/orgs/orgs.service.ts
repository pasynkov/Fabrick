import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ApiKeyAuditLevel } from '../entities/api-key-audit-log.entity';
import { OrgMember } from '../entities/org-member.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { ApiKeyAuditService, AuditContext } from '../api-keys/api-key-audit.service';
import { ApiKeyEncryptionService } from '../api-keys/api-key-encryption.service';
import { ApiKeyValidationService } from '../api-keys/api-key-validation.service';
import { UpdateOrgDto } from './dto/update-org.dto';

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
    private readonly apiKeyEncryptionService: ApiKeyEncryptionService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
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
    if (!m || m.role !== 'admin') throw new ForbiddenException();
  }

  async requireMember(userId: string, orgId: string) {
    const m = await this.memberRepo.findOne({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException();
  }

  async updateOrg(orgId: string, dto: UpdateOrgDto, context: AuditContext) {
    await this.requireAdmin(context.userId, orgId);
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');

    const updates: Partial<Organization> = {};

    if (dto.name !== undefined) {
      if (!dto.name || dto.name.length === 0) throw new BadRequestException('Name must not be empty');
      const oldName = org.name;
      updates.name = dto.name;
      this.logger.log(`Org ${orgId} name changed from "${oldName}" to "${dto.name}" by user ${context.userId}`);
    }

    if (dto.anthropicApiKey !== undefined) {
      if (dto.anthropicApiKey === null) {
        if (org.anthropicApiKey) {
          let keyHash: string;
          try {
            const decryptedKey = this.apiKeyEncryptionService.decrypt(org.anthropicApiKey);
            keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);
          } catch {
            keyHash = 'decrypt-failed';
          }
          await this.apiKeyAuditService.logApiKeyDelete(ApiKeyAuditLevel.ORGANIZATION, orgId, keyHash, context);
        }
        updates.anthropicApiKey = null;
      } else {
        const validation = this.apiKeyValidationService.validateFormat(dto.anthropicApiKey);
        if (!validation.isValid) {
          await this.apiKeyAuditService.logValidationFailure(ApiKeyAuditLevel.ORGANIZATION, orgId, validation.errors, context);
          throw new BadRequestException(validation.errors);
        }
        const isUpdate = !!org.anthropicApiKey;
        updates.anthropicApiKey = this.apiKeyEncryptionService.encrypt(dto.anthropicApiKey);
        await this.apiKeyAuditService.logApiKeySet(ApiKeyAuditLevel.ORGANIZATION, orgId, dto.anthropicApiKey, isUpdate, context);
      }
    }

    await this.orgRepo.update(orgId, updates);

    return {
      id: orgId,
      name: updates.name ?? org.name,
      slug: org.slug,
      hasApiKey: updates.anthropicApiKey !== undefined
        ? updates.anthropicApiKey !== null
        : !!org.anthropicApiKey,
    };
  }

  async updateOrgName(orgId: string, name: string, userId: string) {
    return this.updateOrg(orgId, { name }, { userId });
  }

  async getOrgApiKeyStatus(orgId: string) {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');

    return {
      hasApiKey: !!org.anthropicApiKey,
      source: 'organization' as const,
      keyHash: org.anthropicApiKey
        ? this.apiKeyEncryptionService.generateKeyHash(
            this.apiKeyEncryptionService.decrypt(org.anthropicApiKey),
          )
        : undefined,
    };
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
