# API Key Management Endpoints

## Overview
REST API endpoints for managing Anthropic API keys at organization and project levels, including CRUD operations, validation, and audit log retrieval.

## Organization API Key Endpoints

### PUT /orgs/:orgId/api-key
Updates or sets the Anthropic API key for an organization.

#### Request
```typescript
// Request body
interface SetOrgApiKeyDto {
  apiKey: string;
  validateConnectivity?: boolean; // Default: false
}

// Headers
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

#### Response
```typescript
// 200 Success
interface SetApiKeyResponse {
  success: boolean;
  message: string;
  validation?: {
    warnings: string[];
  };
}

// 400 Bad Request
interface ValidationErrorResponse {
  statusCode: 400;
  message: string[];
  error: "Bad Request";
  details: {
    validationErrors: string[];
    validationWarnings: string[];
  };
}
```

#### Implementation
```typescript
// applications/backend/api/src/orgs/orgs.controller.ts
@Put(':orgId/api-key')
@UseGuards(IsAdminGuard)
async setApiKey(
  @Request() req: { user: { id: string }; ip?: string },
  @Param('orgId') orgId: string,
  @Body() body: SetOrgApiKeyDto,
  @Headers('user-agent') userAgent?: string,
): Promise<SetApiKeyResponse> {
  return this.orgsService.setApiKey(
    orgId,
    body.apiKey,
    body.validateConnectivity ?? false,
    {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent,
    },
  );
}
```

### DELETE /orgs/:orgId/api-key
Removes the API key for an organization, falling back to global key.

#### Response
```typescript
// 200 Success
interface DeleteApiKeyResponse {
  success: boolean;
  message: string;
}
```

### GET /orgs/:orgId/api-key/status
Checks if an organization has an API key configured (without exposing the key).

#### Response
```typescript
interface ApiKeyStatusResponse {
  hasApiKey: boolean;
  source: 'organization' | 'global';
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

## Project API Key Endpoints

### PUT /projects/:projectId/api-key
Updates or sets the Anthropic API key for a project.

#### Request
```typescript
interface SetProjectApiKeyDto {
  apiKey: string;
  validateConnectivity?: boolean;
}
```

#### Implementation
```typescript
// applications/backend/api/src/repos/repos.controller.ts
@Put(':projectId/api-key')
async setApiKey(
  @Request() req: { user: { id: string }; ip?: string },
  @Param('projectId') projectId: string,
  @Body() body: SetProjectApiKeyDto,
  @Headers('user-agent') userAgent?: string,
): Promise<SetApiKeyResponse> {
  return this.reposService.setProjectApiKey(
    projectId,
    body.apiKey,
    body.validateConnectivity ?? false,
    req.user.id,
    {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent,
    },
  );
}
```

### DELETE /projects/:projectId/api-key
Removes the project's API key, falling back to organization or global key.

### GET /projects/:projectId/api-key/status
Checks project API key configuration and resolution chain.

#### Response
```typescript
interface ProjectApiKeyStatusResponse {
  hasProjectApiKey: boolean;
  hasOrgApiKey: boolean;
  effectiveSource: 'project' | 'organization' | 'global';
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
async setApiKey(
  orgId: string,
  apiKey: string,
  validateConnectivity: boolean,
  context: AuditContext,
): Promise<SetApiKeyResponse> {
  // Verify user has admin access to organization
  await this.requireOrgAdmin(context.userId, orgId);

  // Validate API key format
  const validation = await this.apiKeyValidationService.validate(
    apiKey,
    validateConnectivity,
  );

  if (!validation.isValid) {
    await this.apiKeyAuditService.logValidationFailure(
      ApiKeyAuditLevel.ORGANIZATION,
      orgId,
      validation.errors,
      context,
    );
    throw new BadRequestException({
      message: validation.errors,
      details: {
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      },
    });
  }

  // Check if this is an update or new key
  const existingOrg = await this.orgRepo.findOne({ where: { id: orgId } });
  const isUpdate = !!existingOrg?.anthropicApiKey;

  // Encrypt and store API key
  const encryptedKey = await this.apiKeyEncryptionService.encrypt(apiKey);
  await this.orgRepo.update(orgId, { anthropicApiKey: encryptedKey });

  // Audit the operation
  await this.apiKeyAuditService.logApiKeySet(
    ApiKeyAuditLevel.ORGANIZATION,
    orgId,
    apiKey,
    isUpdate,
    context,
  );

  return {
    success: true,
    message: isUpdate ? 'API key updated successfully' : 'API key set successfully',
    validation: validation.warnings.length > 0 ? { warnings: validation.warnings } : undefined,
  };
}

async deleteApiKey(orgId: string, context: AuditContext): Promise<DeleteApiKeyResponse> {
  await this.requireOrgAdmin(context.userId, orgId);

  const org = await this.orgRepo.findOne({ where: { id: orgId } });
  if (!org?.anthropicApiKey) {
    throw new NotFoundException('No API key configured for this organization');
  }

  // Generate hash for audit before deletion
  const decryptedKey = await this.apiKeyEncryptionService.decrypt(org.anthropicApiKey);
  const keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);

  // Delete the API key
  await this.orgRepo.update(orgId, { anthropicApiKey: null });

  // Audit the deletion
  await this.apiKeyAuditService.logApiKeyDelete(
    ApiKeyAuditLevel.ORGANIZATION,
    orgId,
    keyHash,
    context,
  );

  return {
    success: true,
    message: 'API key removed successfully',
  };
}

async getApiKeyStatus(orgId: string, userId: string): Promise<ApiKeyStatusResponse> {
  await this.requireOrgMember(userId, orgId);

  const org = await this.orgRepo.findOne({ where: { id: orgId } });
  const hasApiKey = !!org?.anthropicApiKey;

  let keyHash: string | undefined;
  if (hasApiKey) {
    try {
      const decryptedKey = await this.apiKeyEncryptionService.decrypt(org.anthropicApiKey!);
      keyHash = this.apiKeyEncryptionService.generateKeyHash(decryptedKey);
    } catch (error) {
      // If decryption fails, still show that a key exists but is problematic
    }
  }

  return {
    hasApiKey,
    source: hasApiKey ? 'organization' : 'global',
    keyHash,
  };
}
```

### ReposService Updates for Projects
```typescript
// applications/backend/api/src/repos/repos.service.ts
async setProjectApiKey(
  projectId: string,
  apiKey: string,
  validateConnectivity: boolean,
  userId: string,
  context: AuditContext,
): Promise<SetApiKeyResponse> {
  const project = await this.projectRepo.findOne({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundException('Project not found');
  }

  // Verify user has access to the organization
  await this.requireOrgMember(userId, project.orgId);

  // Validate API key
  const validation = await this.apiKeyValidationService.validate(
    apiKey,
    validateConnectivity,
  );

  if (!validation.isValid) {
    await this.apiKeyAuditService.logValidationFailure(
      ApiKeyAuditLevel.PROJECT,
      projectId,
      validation.errors,
      context,
    );
    throw new BadRequestException({
      message: validation.errors,
      details: {
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      },
    });
  }

  const isUpdate = !!project.anthropicApiKey;

  // Encrypt and store
  const encryptedKey = await this.apiKeyEncryptionService.encrypt(apiKey);
  await this.projectRepo.update(projectId, { anthropicApiKey: encryptedKey });

  // Audit the operation
  await this.apiKeyAuditService.logApiKeySet(
    ApiKeyAuditLevel.PROJECT,
    projectId,
    apiKey,
    isUpdate,
    context,
  );

  return {
    success: true,
    message: isUpdate ? 'Project API key updated successfully' : 'Project API key set successfully',
    validation: validation.warnings.length > 0 ? { warnings: validation.warnings } : undefined,
  };
}
```

## DTOs and Validation

### Data Transfer Objects
```typescript
// applications/backend/api/src/api-keys/dto/set-api-key.dto.ts
import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class SetApiKeyDto {
  @IsString()
  @MinLength(20, { message: 'API key must be at least 20 characters long' })
  apiKey: string;

  @IsOptional()
  @IsBoolean()
  validateConnectivity?: boolean;
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