# API Key Management Endpoints

## Overview
API key management is handled via the existing settings endpoints for organizations and projects. No separate `/api-key` routes are created — the `anthropicApiKey` field is updated through the same PATCH endpoint used for other settings (e.g., name).

## Organization API Key Endpoint

### PATCH /orgs/:orgId
Updates organization settings including the API key field.

#### Request
```typescript
// Request body (anthropicApiKey field added to existing org update DTO)
interface UpdateOrgDto {
  name?: string;
  anthropicApiKey?: string | null; // null to remove the key
}

// Headers
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

#### Response
```typescript
// 200 Success
interface UpdateOrgResponse {
  id: string;
  name: string;
  slug: string;
  hasApiKey: boolean; // whether an API key is configured; never returns the key itself
}

// 400 Bad Request (invalid key format)
interface ValidationErrorResponse {
  statusCode: 400;
  message: string[];
  error: "Bad Request";
}
```

#### Implementation
```typescript
// applications/backend/api/src/orgs/orgs.controller.ts
@Patch(':orgId')
@UseGuards(IsAdminGuard)
async updateOrg(
  @Request() req: { user: { id: string }; ip?: string },
  @Param('orgId') orgId: string,
  @Body() body: UpdateOrgDto,
  @Headers('user-agent') userAgent?: string,
): Promise<UpdateOrgResponse> {
  return this.orgsService.updateOrg(orgId, body, {
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent,
  });
}
```

### GET /orgs/:orgId/api-key/status
Checks if an organization has an API key configured (without exposing the key).

#### Response
```typescript
interface ApiKeyStatusResponse {
  hasApiKey: boolean;
  source: 'organization';
  lastUpdated?: string; // ISO date string
  keyHash?: string; // For audit correlation
}
```

### GET /orgs/:orgId/api-key/audit-logs
Retrieves audit logs for organization API key operations.

#### Query Parameters
```typescript
interface AuditLogsQuery {
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Default: 0
  action?: string; // Filter by action type
}
```

#### Response
```typescript
interface AuditLogsResponse {
  logs: Array<{
    id: string;
    action: string;
    timestamp: string;
    userId: string;
    keyHash: string;
    details?: any;
    ipAddress?: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

## Project API Key Endpoint

### PATCH /projects/:projectId
Updates project settings including the API key field.

#### Request
```typescript
// Request body (anthropicApiKey field added to existing project update DTO)
interface UpdateProjectDto {
  name?: string;
  anthropicApiKey?: string | null; // null to remove the key
}
```

#### Implementation
```typescript
// applications/backend/api/src/repos/repos.controller.ts
@Patch(':projectId')
async updateProject(
  @Request() req: { user: { id: string }; ip?: string },
  @Param('projectId') projectId: string,
  @Body() body: UpdateProjectDto,
  @Headers('user-agent') userAgent?: string,
): Promise<UpdateProjectResponse> {
  return this.reposService.updateProject(projectId, body, req.user.id, {
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent,
  });
}
```

### GET /projects/:projectId/api-key/status
Checks project API key configuration and resolution chain.

#### Response
```typescript
interface ProjectApiKeyStatusResponse {
  hasProjectApiKey: boolean;
  hasOrgApiKey: boolean;
  effectiveSource: 'project' | 'organization' | 'none';
  projectKeyLastUpdated?: string;
  orgKeyLastUpdated?: string;
  keyHashes: {
    project?: string;
    organization?: string;
  };
}
```

### GET /projects/:projectId/api-key/audit-logs
Retrieves audit logs for project API key operations.

## Service Layer Implementation

### OrgsService Updates
```typescript
// applications/backend/api/src/orgs/orgs.service.ts
async updateOrg(
  orgId: string,
  dto: UpdateOrgDto,
  context: AuditContext,
): Promise<UpdateOrgResponse> {
  await this.requireOrgAdmin(context.userId, orgId);

  const existingOrg = await this.orgRepo.findOne({ where: { id: orgId } });
  if (!existingOrg) throw new NotFoundException('Organization not found');

  const updates: Partial<Organization> = {};

  if (dto.name !== undefined) {
    updates.name = dto.name;
  }

  if (dto.anthropicApiKey !== undefined) {
    if (dto.anthropicApiKey === null) {
      // Remove key
      const isUpdate = !!existingOrg.anthropicApiKey;
      if (isUpdate) {
        const decryptedKey = await this.apiKeyEncryptionService.decrypt(existingOrg.anthropicApiKey!);
        const keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);
        await this.apiKeyAuditService.logApiKeyDelete(ApiKeyAuditLevel.ORGANIZATION, orgId, keyHash, context);
      }
      updates.anthropicApiKey = null;
    } else {
      // Validate format (prefix only)
      const validation = this.apiKeyValidationService.validateFormat(dto.anthropicApiKey);
      if (!validation.isValid) {
        await this.apiKeyAuditService.logValidationFailure(ApiKeyAuditLevel.ORGANIZATION, orgId, validation.errors, context);
        throw new BadRequestException(validation.errors);
      }
      const isUpdate = !!existingOrg.anthropicApiKey;
      updates.anthropicApiKey = await this.apiKeyEncryptionService.encrypt(dto.anthropicApiKey);
      await this.apiKeyAuditService.logApiKeySet(ApiKeyAuditLevel.ORGANIZATION, orgId, dto.anthropicApiKey, isUpdate, context);
    }
  }

  await this.orgRepo.update(orgId, updates);

  return {
    id: orgId,
    name: updates.name ?? existingOrg.name,
    slug: existingOrg.slug,
    hasApiKey: updates.anthropicApiKey !== undefined
      ? updates.anthropicApiKey !== null
      : !!existingOrg.anthropicApiKey,
  };
}
```

### ReposService Updates for Projects
```typescript
// applications/backend/api/src/repos/repos.service.ts
async updateProject(
  projectId: string,
  dto: UpdateProjectDto,
  userId: string,
  context: AuditContext,
): Promise<UpdateProjectResponse> {
  const project = await this.projectRepo.findOne({ where: { id: projectId } });
  if (!project) throw new NotFoundException('Project not found');

  await this.requireOrgMember(userId, project.orgId);

  const updates: Partial<Project> = {};

  if (dto.name !== undefined) {
    updates.name = dto.name;
  }

  if (dto.anthropicApiKey !== undefined) {
    if (dto.anthropicApiKey === null) {
      const isUpdate = !!project.anthropicApiKey;
      if (isUpdate) {
        const decryptedKey = await this.apiKeyEncryptionService.decrypt(project.anthropicApiKey!);
        const keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);
        await this.apiKeyAuditService.logApiKeyDelete(ApiKeyAuditLevel.PROJECT, projectId, keyHash, context);
      }
      updates.anthropicApiKey = null;
    } else {
      const validation = this.apiKeyValidationService.validateFormat(dto.anthropicApiKey);
      if (!validation.isValid) {
        await this.apiKeyAuditService.logValidationFailure(ApiKeyAuditLevel.PROJECT, projectId, validation.errors, context);
        throw new BadRequestException(validation.errors);
      }
      const isUpdate = !!project.anthropicApiKey;
      updates.anthropicApiKey = await this.apiKeyEncryptionService.encrypt(dto.anthropicApiKey);
      await this.apiKeyAuditService.logApiKeySet(ApiKeyAuditLevel.PROJECT, projectId, dto.anthropicApiKey, isUpdate, context);
    }
  }

  await this.projectRepo.update(projectId, updates);

  return {
    id: projectId,
    name: updates.name ?? project.name,
    slug: project.slug,
    hasApiKey: updates.anthropicApiKey !== undefined
      ? updates.anthropicApiKey !== null
      : !!project.anthropicApiKey,
  };
}
```

## DTOs and Validation

### Data Transfer Objects
```typescript
// applications/backend/api/src/orgs/dto/update-org.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  anthropicApiKey?: string | null;
}

// applications/backend/api/src/repos/dto/update-project.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  anthropicApiKey?: string | null;
}

// applications/backend/api/src/api-keys/dto/audit-logs-query.dto.ts
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  action?: string;
}
```

## Error Handling

### Common Error Responses
```typescript
// 401 Unauthorized - Invalid or missing JWT
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}

// 403 Forbidden - User not admin of organization
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}

// 404 Not Found - Organization or project not found
{
  "statusCode": 404,
  "message": "Organization not found",
  "error": "Not Found"
}

// 400 Bad Request - API key validation failed
{
  "statusCode": 400,
  "message": [
    "API key must start with sk-ant-",
    "API key appears too short"
  ],
  "error": "Bad Request",
  "details": {
    "validationErrors": [
      "API key must start with sk-ant-",
      "API key appears too short"
    ],
    "validationWarnings": []
  }
}
```

## Security Considerations

### Authorization
- Organization API key endpoints require `IsAdminGuard`
- Project API key endpoints require organization membership
- Audit log endpoints require appropriate resource access

### Input Validation
- API key format validation before storage
- Optional connectivity testing
- Proper DTO validation with class-validator

### Sensitive Data Handling
- API keys are never returned in responses
- Only status information and hashes are exposed
- Comprehensive audit logging without key exposure

### Rate Limiting
Consider implementing rate limiting for:
- API key validation endpoints (especially connectivity tests)
- Audit log retrieval endpoints
- API key update operations