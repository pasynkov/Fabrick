import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyAuditLog, ApiKeyAuditAction, ApiKeyAuditLevel } from '../entities/api-key-audit-log.entity';
import { ApiKeyEncryptionService } from './api-key-encryption.service';

export interface AuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKeyOperationAudit {
  action: ApiKeyAuditAction;
  level: ApiKeyAuditLevel;
  organizationId?: string;
  projectId?: string;
  apiKey?: string;
  details?: Record<string, any>;
  context: AuditContext;
}

@Injectable()
export class ApiKeyAuditService {
  private readonly logger = new Logger(ApiKeyAuditService.name);

  constructor(
    @InjectRepository(ApiKeyAuditLog)
    private readonly auditRepo: Repository<ApiKeyAuditLog>,
    private readonly encryptionService: ApiKeyEncryptionService,
  ) {}

  async logOperation(audit: ApiKeyOperationAudit): Promise<void> {
    try {
      const keyHash = audit.apiKey
        ? this.encryptionService.generateKeyHash(audit.apiKey)
        : 'no-key-000000000';

      const auditLog = this.auditRepo.create({
        action: audit.action,
        level: audit.level,
        organizationId: audit.organizationId || null,
        projectId: audit.projectId || null,
        userId: audit.context.userId,
        keyHash: keyHash.slice(0, 16),
        details: audit.details ? JSON.stringify(audit.details) : null,
        ipAddress: audit.context.ipAddress || null,
        userAgent: audit.context.userAgent || null,
      });

      await this.auditRepo.save(auditLog);
      this.logger.log(`API key ${audit.action} logged for ${audit.level} ${audit.organizationId || audit.projectId}`);
    } catch (error: any) {
      this.logger.error(`Failed to log API key audit: ${error.message}`);
    }
  }

  async logApiKeyUsage(resolution: { apiKey: string; source: string; projectId?: string; orgId?: string }): Promise<void> {
    await this.logOperation({
      action: ApiKeyAuditAction.USE,
      level: resolution.projectId ? ApiKeyAuditLevel.PROJECT : ApiKeyAuditLevel.ORGANIZATION,
      organizationId: resolution.orgId,
      projectId: resolution.projectId,
      apiKey: resolution.apiKey,
      details: { source: resolution.source },
      context: { userId: 'system' },
    });
  }

  async logApiKeySet(
    level: ApiKeyAuditLevel,
    resourceId: string,
    apiKey: string,
    isUpdate: boolean,
    context: AuditContext,
  ): Promise<void> {
    await this.logOperation({
      action: isUpdate ? ApiKeyAuditAction.UPDATE : ApiKeyAuditAction.SET,
      level,
      organizationId: level === ApiKeyAuditLevel.ORGANIZATION ? resourceId : undefined,
      projectId: level === ApiKeyAuditLevel.PROJECT ? resourceId : undefined,
      apiKey,
      context,
    });
  }

  async logApiKeyDelete(
    level: ApiKeyAuditLevel,
    resourceId: string,
    previousKeyHash: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logOperation({
      action: ApiKeyAuditAction.DELETE,
      level,
      organizationId: level === ApiKeyAuditLevel.ORGANIZATION ? resourceId : undefined,
      projectId: level === ApiKeyAuditLevel.PROJECT ? resourceId : undefined,
      details: { previousKeyHash },
      context,
    });
  }

  async logValidationFailure(
    level: ApiKeyAuditLevel,
    resourceId: string,
    errors: string[],
    context: AuditContext,
  ): Promise<void> {
    await this.logOperation({
      action: ApiKeyAuditAction.VALIDATION_FAILED,
      level,
      organizationId: level === ApiKeyAuditLevel.ORGANIZATION ? resourceId : undefined,
      projectId: level === ApiKeyAuditLevel.PROJECT ? resourceId : undefined,
      details: { validationErrors: errors },
      context,
    });
  }

  async getOrganizationAuditLogs(
    orgId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ logs: ApiKeyAuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepo.findAndCount({
      where: { organizationId: orgId },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { logs, total };
  }

  async getProjectAuditLogs(
    projectId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ logs: ApiKeyAuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepo.findAndCount({
      where: { projectId },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { logs, total };
  }
}
