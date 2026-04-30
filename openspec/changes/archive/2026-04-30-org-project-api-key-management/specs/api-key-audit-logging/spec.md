# API Key Audit Logging Service

## Overview
Secure audit logging service for API key operations that tracks API key management events without exposing actual key values, using hashed identifiers for correlation.

## Database Schema

### ApiKeyAuditLog Entity
```typescript
// applications/backend/api/src/entities/api-key-audit-log.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ApiKeyAuditAction {
  SET = 'set',
  UPDATE = 'update',
  DELETE = 'delete',
  USE = 'use',
  DECRYPT_FAILED = 'decrypt_failed',
  VALIDATION_FAILED = 'validation_failed',
}

export enum ApiKeyAuditLevel {
  ORGANIZATION = 'organization',
  PROJECT = 'project',
}

@Entity('api_key_audit_logs')
export class ApiKeyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ApiKeyAuditAction })
  action: ApiKeyAuditAction;

  @Column({ type: 'enum', enum: ApiKeyAuditLevel })
  level: ApiKeyAuditLevel;

  @Column({ nullable: true })
  organizationId: string | null;

  @Column({ nullable: true })
  projectId: string | null;

  @Column()
  userId: string; // User who performed the action

  @Column({ length: 16 })
  keyHash: string; // First 16 chars of SHA256 hash for correlation

  @Column({ nullable: true, type: 'text' })
  details: string | null; // Additional context (JSON string)

  @Column({ nullable: true })
  ipAddress: string | null;

  @Column({ nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
```

### Migration for Audit Log Table
```sql
-- Migration for audit logging table
CREATE TABLE api_key_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  organizationId UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
  projectId UUID NULL REFERENCES projects(id) ON DELETE CASCADE,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  keyHash VARCHAR(16) NOT NULL,
  details TEXT NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON api_key_audit_logs(organizationId);
CREATE INDEX idx_audit_logs_project_id ON api_key_audit_logs(projectId);
CREATE INDEX idx_audit_logs_user_id ON api_key_audit_logs(userId);
CREATE INDEX idx_audit_logs_timestamp ON api_key_audit_logs(timestamp);
CREATE INDEX idx_audit_logs_key_hash ON api_key_audit_logs(keyHash);
```

## ApiKeyAuditService

### Service Implementation
```typescript
// applications/backend/api/src/api-keys/api-key-audit.service.ts
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
  apiKey?: string; // Will be hashed, never stored plaintext
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

  /**
   * Logs an API key operation for audit purposes
   */
  async logOperation(audit: ApiKeyOperationAudit): Promise<void> {
    try {
      const keyHash = audit.apiKey 
        ? this.encryptionService.generateKeyHash(audit.apiKey)
        : 'no-key';

      const auditLog = this.auditRepo.create({
        action: audit.action,
        level: audit.level,
        organizationId: audit.organizationId || null,
        projectId: audit.projectId || null,
        userId: audit.context.userId,
        keyHash,
        details: audit.details ? JSON.stringify(audit.details) : null,
        ipAddress: audit.context.ipAddress || null,
        userAgent: audit.context.userAgent || null,
      });

      await this.auditRepo.save(auditLog);
      
      this.logger.log(`API key ${audit.action} logged for ${audit.level} ${audit.organizationId || audit.projectId}`);
    } catch (error: any) {
      this.logger.error(`Failed to log API key audit: ${error.message}`);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }

  /**
   * Logs API key usage for synthesis operations
   */
  async logApiKeyUsage(resolution: any): Promise<void> {
    await this.logOperation({
      action: ApiKeyAuditAction.USE,
      level: resolution.projectId ? ApiKeyAuditLevel.PROJECT : ApiKeyAuditLevel.ORGANIZATION,
      organizationId: resolution.orgId,
      projectId: resolution.projectId,
      apiKey: resolution.apiKey,
      details: { source: resolution.source },
      context: { userId: 'system' }, // System-initiated usage
    });
  }

  /**
   * Logs API key setting/updating by users
   */
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

  /**
   * Logs API key deletion
   */
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

  /**
   * Logs decryption failures for debugging
   */
  async logDecryptionFailure(
    level: ApiKeyAuditLevel,
    resourceId: string,
    error: string,
  ): Promise<void> {
    await this.logOperation({
      action: ApiKeyAuditAction.DECRYPT_FAILED,
      level,
      organizationId: level === ApiKeyAuditLevel.ORGANIZATION ? resourceId : undefined,
      projectId: level === ApiKeyAuditLevel.PROJECT ? resourceId : undefined,
      details: { error },
      context: { userId: 'system' },
    });
  }

  /**
   * Logs validation failures
   */
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

  /**
   * Retrieves audit logs for an organization
   */
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

  /**
   * Retrieves audit logs for a project
   */
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

  /**
   * Retrieves audit logs by key hash for correlation
   */
  async getLogsByKeyHash(keyHash: string): Promise<ApiKeyAuditLog[]> {
    return this.auditRepo.find({
      where: { keyHash },
      order: { timestamp: 'DESC' },
    });
  }
}
```

## Integration with Other Services

### Organization Service Integration
```typescript
// In OrganizationService.updateApiKey method
async updateApiKey(orgId: string, apiKey: string, userId: string, context: AuditContext) {
  const isUpdate = await this.hasExistingApiKey(orgId);
  
  // Validate and encrypt
  const validation = await this.validationService.validate(apiKey);
  if (!validation.isValid) {
    await this.auditService.logValidationFailure(
      ApiKeyAuditLevel.ORGANIZATION,
      orgId,
      validation.errors,
      context
    );
    throw new BadRequestException(validation.errors);
  }

  const encrypted = await this.encryptionService.encrypt(apiKey);
  await this.orgRepo.update(orgId, { anthropicApiKey: encrypted });

  // Audit the operation
  await this.auditService.logApiKeySet(
    ApiKeyAuditLevel.ORGANIZATION,
    orgId,
    apiKey,
    isUpdate,
    context
  );
}
```

### API Key Resolution Integration
```typescript
// In ApiKeyResolutionService.resolveForProject method
try {
  const decryptedKey = await this.encryptionService.decrypt(project.anthropicApiKey);
  // Log successful usage
  await this.auditService.logApiKeyUsage({
    apiKey: decryptedKey,
    source: 'project',
    projectId: project.id,
    orgId: project.orgId,
  });
  return { apiKey: decryptedKey, source: 'project' };
} catch (error) {
  // Log decryption failure
  await this.auditService.logDecryptionFailure(
    ApiKeyAuditLevel.PROJECT,
    project.id,
    error.message
  );
  // Continue to fallback...
}
```

## Security and Privacy Considerations

### Data Protection
- **No plaintext keys**: API keys are never stored in audit logs
- **Hash-based correlation**: Use 16-character SHA256 hash prefix for key correlation
- **User context**: Track user actions for accountability
- **IP and User-Agent logging**: Additional context for security analysis

### Retention Policy
- **Log retention**: Consider implementing automated cleanup after reasonable retention period
- **Sensitive data**: Ensure no sensitive data leaks into details field
- **Compliance**: Structure supports regulatory audit requirements

### Performance Impact
- **Async logging**: Consider making audit logging asynchronous to avoid blocking operations
- **Error isolation**: Audit failures don't impact main functionality
- **Database indexing**: Proper indexing for efficient audit log queries

## Usage Examples

### Logging API Key Updates
```typescript
await auditService.logApiKeySet(
  ApiKeyAuditLevel.ORGANIZATION,
  orgId,
  newApiKey,
  false, // isUpdate
  {
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }
);
```

### Querying Audit Logs
```typescript
const { logs, total } = await auditService.getOrganizationAuditLogs(orgId, 25, 0);
// Display audit logs in UI with pagination
```