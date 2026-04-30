import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyAuditLog } from '../entities/api-key-audit-log.entity';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { ApiKeyAuditService } from './api-key-audit.service';
import { ApiKeyEncryptionService } from './api-key-encryption.service';
import { ApiKeyResolutionService } from './api-key-resolution.service';
import { ApiKeyValidationService } from './api-key-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Project, ApiKeyAuditLog])],
  providers: [
    ApiKeyEncryptionService,
    ApiKeyValidationService,
    ApiKeyResolutionService,
    ApiKeyAuditService,
  ],
  exports: [
    ApiKeyEncryptionService,
    ApiKeyValidationService,
    ApiKeyResolutionService,
    ApiKeyAuditService,
  ],
})
export class ApiKeysModule {}
