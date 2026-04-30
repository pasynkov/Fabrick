# API Key Resolution Service

## Overview
Hierarchical API key resolution service that determines which Anthropic API key to use for synthesis operations following the pattern: project key → organization key → error (no global fallback).

## Service Interface

### ApiKeyResolutionService
```typescript
// applications/backend/api/src/api-keys/api-key-resolution.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { Project } from '../entities/project.entity';
import { ApiKeyEncryptionService } from './api-key-encryption.service';

interface ApiKeyResolution {
  apiKey: string;
  source: 'project' | 'organization';
  projectId?: string;
  orgId?: string;
}

@Injectable()
export class ApiKeyResolutionService {
  private readonly logger = new Logger(ApiKeyResolutionService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly encryptionService: ApiKeyEncryptionService,
  ) {}

  /**
   * Resolves the API key to use for a given project
   * Priority: project key → org key → global env var
   */
  async resolveForProject(projectId: string): Promise<ApiKeyResolution> {
    // Try to get project with organization data
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['org'],
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Check project-level API key first
    if (project.anthropicApiKey) {
      try {
        const decryptedKey = await this.encryptionService.decrypt(project.anthropicApiKey);
        this.logger.debug(`Using project-level API key for project ${projectId}`);
        return {
          apiKey: decryptedKey,
          source: 'project',
          projectId: project.id,
          orgId: project.orgId,
        };
      } catch (error) {
        this.logger.warn(`Failed to decrypt project API key for ${projectId}: ${error.message}`);
      }
    }

    // Fall back to organization-level API key
    const org = (project as any).org as Organization;
    if (org?.anthropicApiKey) {
      try {
        const decryptedKey = await this.encryptionService.decrypt(org.anthropicApiKey);
        this.logger.debug(`Using organization-level API key for project ${projectId}`);
        return {
          apiKey: decryptedKey,
          source: 'organization',
          projectId: project.id,
          orgId: org.id,
        };
      } catch (error) {
        this.logger.warn(`Failed to decrypt org API key for ${org.id}: ${error.message}`);
      }
    }

    // No key available — do not fall back to global
    throw new Error(`No API key available for project ${projectId}. Please configure an API key for this project or organization.`);
  }

  /**
   * Resolves the API key for an organization (for org-level operations)
   */
  async resolveForOrganization(orgId: string): Promise<ApiKeyResolution> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    
    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    // Check organization-level API key
    if (org.anthropicApiKey) {
      try {
        const decryptedKey = await this.encryptionService.decrypt(org.anthropicApiKey);
        this.logger.debug(`Using organization-level API key for org ${orgId}`);
        return {
          apiKey: decryptedKey,
          source: 'organization',
          orgId: org.id,
        };
      } catch (error) {
        this.logger.warn(`Failed to decrypt org API key for ${orgId}: ${error.message}`);
      }
    }

    // No key available — do not fall back to global
    throw new Error(`No API key available for organization ${orgId}. Please configure an API key for this organization.`);
  }

  /**
   * Validates that an API key resolution result is valid
   */
  validateResolution(resolution: ApiKeyResolution): boolean {
    return !!(resolution.apiKey && resolution.source && 
             resolution.apiKey.startsWith('sk-ant-'));
  }
}
```

## Resolution Logic Flow

### For Project-level Operations
1. **Project Key Check**: Query project entity for `anthropicApiKey`
   - If present and decryption succeeds → use project key
   - If present but decryption fails → log warning, continue to step 2
   - If null → continue to step 2

2. **Organization Key Check**: Query organization entity for `anthropicApiKey`
   - If present and decryption succeeds → use organization key
   - If present but decryption fails → log warning, throw error
   - If null → throw error with user-facing message to configure a key

### For Organization-level Operations
1. **Organization Key Check**: Query organization entity for `anthropicApiKey`
   - If present and decryption succeeds → use organization key
   - If present but decryption fails → log warning, throw error
   - If null → throw error with user-facing message to configure a key

## Error Handling

### Decryption Failures
- Log warnings for decryption failures but continue resolution process
- Do not expose encryption details in error messages
- Fall through to next priority level on decryption failure

### Missing Keys
- Throw descriptive errors when no API key is available at any level
- Include project/organization context in error messages for debugging

### Invalid Keys  
- Validate API key format during resolution
- Log warnings for invalid key formats but attempt to use them (format validation is advisory)

## Integration Points

### Synthesis Service
```typescript
// Updated synthesis service to use resolution
const resolution = await this.apiKeyResolutionService.resolveForProject(projectId);
await this.auditLogService.logApiKeyUsage(resolution);
```

### Audit Logging
```typescript
// Log API key usage without exposing the actual key
await this.auditLogService.logApiKeyUsage({
  projectId: resolution.projectId,
  orgId: resolution.orgId,
  source: resolution.source,
  keyHash: this.generateKeyHash(resolution.apiKey),
  timestamp: new Date(),
});
```

## Performance Considerations

- **Caching**: Consider implementing short-term caching of decrypted keys to reduce crypto operations
- **Database queries**: Use joins to fetch project + org data in single query when possible
- **Lazy loading**: Only decrypt keys when they're actually needed for API calls
- **Connection pooling**: Ensure proper database connection management for frequent resolutions