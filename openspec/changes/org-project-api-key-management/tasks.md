## 1. Database Schema and Migration

- [x] 1.1 Create TypeORM migration to add `anthropicApiKey` columns to organizations and projects tables
- [x] 1.2 Update Organization entity with nullable `anthropicApiKey` field
- [x] 1.3 Update Project entity with nullable `anthropicApiKey` field  
- [x] 1.4 Add appropriate database indexes for API key lookups
- [ ] 1.5 Create and test rollback migration scripts

## 2. API Key Encryption and Validation Services

- [x] 2.1 Implement ApiKeyEncryptionService with AES-256-GCM encryption using global API key
- [x] 2.2 Implement encrypt/decrypt methods with proper error handling
- [x] 2.3 Add generateKeyHash method for audit logging
- [x] 2.4 Implement ApiKeyValidationService with format validation (prefix check only, no connectivity test)
- [ ] 2.5 Create comprehensive unit tests for encryption and validation services

## 3. API Key Resolution Service

- [x] 3.1 Implement ApiKeyResolutionService with hierarchical resolution logic
- [x] 3.2 Add resolveForProject method (project → org; error if neither configured)
- [x] 3.3 Add resolveForOrganization method (org key only; error if not configured)
- [x] 3.4 Implement proper error handling for decryption failures
- [x] 3.5 Add validation of resolution results
- [ ] 3.6 Create unit tests for all resolution scenarios

## 4. Audit Logging System

- [x] 4.1 Create ApiKeyAuditLog entity with proper schema
- [x] 4.2 Create TypeORM migration for audit log table
- [x] 4.3 Implement ApiKeyAuditService with secure logging methods
- [x] 4.4 Add methods for logging API key operations (set/update/delete/use)
- [x] 4.5 Implement audit log retrieval with pagination
- [x] 4.6 Add proper indexing for audit log queries

## 5. API Endpoints for API Key Management

- [x] 5.1 Extend PATCH /orgs/:orgId to accept and handle anthropicApiKey field
- [x] 5.2 Extend PATCH /projects/:projectId to accept and handle anthropicApiKey field
- [x] 5.3 Add GET /orgs/:orgId/api-key/status endpoint for API key status
- [x] 5.4 Add GET /orgs/:orgId/api-key/audit-logs endpoint for audit log retrieval
- [x] 5.5 Add GET /projects/:projectId/api-key/status endpoint with resolution chain info
- [x] 5.6 Add GET /projects/:projectId/api-key/audit-logs endpoint for project audit logs

## 6. Service Layer Integration

- [x] 6.1 Update OrgsService with API key management methods
- [x] 6.2 Update ReposService with project API key management methods
- [x] 6.3 Add proper authorization checks (IsAdminGuard for org operations)
- [x] 6.4 Implement comprehensive input validation with class-validator DTOs
- [x] 6.5 Add proper error handling with user-friendly error messages
- [x] 6.6 Integrate audit logging into all API key operations

## 7. Synthesis Service Integration

- [x] 7.1 Update SynthesisService to use ApiKeyResolutionService
- [x] 7.2 Modify triggerForProject to resolve API keys before queuing jobs
- [x] 7.3 Pass resolved API key information to synthesis jobs
- [x] 7.4 Add proper error handling for API key resolution failures
- [x] 7.5 Update SynthesisProcessor to use job-specific API keys (apiKey always resolved before queuing)
- [x] 7.6 Add enhanced error messaging for API key-related failures

## 8. Frontend UI Components

- [x] 8.1 Create ApiKeySection component for organization and project settings
- [x] 8.2 Implement ApiKeyStatusDisplay component with resolution chain visualization (project → org only, no global fallback)
- [x] 8.3 Create ApiKeyForm component with secure input handling (no connectivity test option)
- [x] 8.4 Add ProjectKeyResolutionChain component for project-specific status (shows "no key" warning when neither configured)
- [x] 8.5 Implement ApiKeyAuditLogs component for activity tracking
- [x] 8.6 Integrate API key management into existing OrgDetail page
- [x] 8.7 Integrate API key management into existing ProjectDetail page
- [x] 8.8 Add proper form validation and error handling in UI

## 9. API Module and Dependency Configuration

- [x] 9.1 Create ApiKeysModule with proper service exports
- [x] 9.2 Update SynthesisModule to import ApiKeysModule
- [x] 9.3 Update OrgsModule to import ApiKeysModule
- [x] 9.4 Configure proper dependency injection for all services
- [x] 9.5 Add ApiKeysModule to main AppModule

## 10. Testing and Quality Assurance

- [ ] 10.1 Create unit tests for all API key service methods
- [ ] 10.2 Add integration tests for API endpoints
- [ ] 10.3 Create end-to-end tests for synthesis with different API key sources
- [ ] 10.4 Test database migrations in staging environment
- [ ] 10.5 Add frontend component tests with React Testing Library
- [ ] 10.6 Test API key encryption/decryption edge cases
- [ ] 10.7 Validate audit logging functionality across all operations

## 11. Security and Performance Testing

- [ ] 11.1 Test API key encryption security (ensure no plaintext storage)
- [ ] 11.2 Validate audit log security (no API key exposure)
- [ ] 11.3 Test authorization controls for all API endpoints
- [ ] 11.4 Performance test API key resolution with large datasets
- [ ] 11.5 Test memory handling for API key data (ensure proper cleanup)
- [ ] 11.6 Validate input sanitization and validation rules

## 12. Documentation and Deployment

- [ ] 12.1 Update API documentation with new endpoints
- [ ] 12.2 Create user documentation for API key management features
- [ ] 12.3 Update environment variable documentation
- [ ] 12.4 Create deployment runbook for database migrations
- [ ] 12.5 Add monitoring and alerting for API key resolution failures
- [ ] 12.6 Update backup procedures to account for encrypted API key data

## 13. Migration and Rollout Strategy

- [ ] 13.1 Deploy backend changes with feature flags disabled
- [ ] 13.2 Run database migrations in production
- [ ] 13.3 Enable API key resolution with global fallback
- [ ] 13.4 Deploy frontend changes for API key management UI
- [ ] 13.5 Gradually enable API key management for pilot organizations
- [ ] 13.6 Monitor synthesis operations for API key-related issues
- [ ] 13.7 Full rollout after successful validation
