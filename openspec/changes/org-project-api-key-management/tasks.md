## 1. Database Schema and Migration

- [ ] 1.1 Create TypeORM migration to add `anthropicApiKey` columns to organizations and projects tables
- [ ] 1.2 Update Organization entity with nullable `anthropicApiKey` field
- [ ] 1.3 Update Project entity with nullable `anthropicApiKey` field  
- [ ] 1.4 Add appropriate database indexes for API key lookups
- [ ] 1.5 Create and test rollback migration scripts

## 2. API Key Encryption and Validation Services

- [ ] 2.1 Implement ApiKeyEncryptionService with AES-256-GCM encryption using global API key
- [ ] 2.2 Implement encrypt/decrypt methods with proper error handling
- [ ] 2.3 Add generateKeyHash method for audit logging
- [ ] 2.4 Implement ApiKeyValidationService with format validation
- [ ] 2.5 Add optional connectivity testing for API key validation
- [ ] 2.6 Create comprehensive unit tests for encryption and validation services

## 3. API Key Resolution Service

- [ ] 3.1 Implement ApiKeyResolutionService with hierarchical resolution logic
- [ ] 3.2 Add resolveForProject method (project → org → global fallback)
- [ ] 3.3 Add resolveForOrganization method (org → global fallback)  
- [ ] 3.4 Implement proper error handling for decryption failures
- [ ] 3.5 Add validation of resolution results
- [ ] 3.6 Create unit tests for all resolution scenarios

## 4. Audit Logging System

- [ ] 4.1 Create ApiKeyAuditLog entity with proper schema
- [ ] 4.2 Create TypeORM migration for audit log table
- [ ] 4.3 Implement ApiKeyAuditService with secure logging methods
- [ ] 4.4 Add methods for logging API key operations (set/update/delete/use)
- [ ] 4.5 Implement audit log retrieval with pagination
- [ ] 4.6 Add proper indexing for audit log queries

## 5. API Endpoints for API Key Management

- [ ] 5.1 Add PUT /orgs/:orgId/api-key endpoint for organization API key management
- [ ] 5.2 Add DELETE /orgs/:orgId/api-key endpoint for removing organization API keys
- [ ] 5.3 Add GET /orgs/:orgId/api-key/status endpoint for API key status
- [ ] 5.4 Add GET /orgs/:orgId/api-key/audit-logs endpoint for audit log retrieval
- [ ] 5.5 Add PUT /projects/:projectId/api-key endpoint for project API key management
- [ ] 5.6 Add DELETE /projects/:projectId/api-key endpoint for removing project API keys
- [ ] 5.7 Add GET /projects/:projectId/api-key/status endpoint with resolution chain info
- [ ] 5.8 Add GET /projects/:projectId/api-key/audit-logs endpoint for project audit logs

## 6. Service Layer Integration

- [ ] 6.1 Update OrgsService with API key management methods
- [ ] 6.2 Update ReposService with project API key management methods
- [ ] 6.3 Add proper authorization checks (IsAdminGuard for org operations)
- [ ] 6.4 Implement comprehensive input validation with class-validator DTOs
- [ ] 6.5 Add proper error handling with user-friendly error messages
- [ ] 6.6 Integrate audit logging into all API key operations

## 7. Synthesis Service Integration

- [ ] 7.1 Update SynthesisService to use ApiKeyResolutionService
- [ ] 7.2 Modify triggerForProject to resolve API keys before queuing jobs
- [ ] 7.3 Pass resolved API key information to synthesis jobs
- [ ] 7.4 Add proper error handling for API key resolution failures
- [ ] 7.5 Update SynthesisProcessor to use job-specific API keys
- [ ] 7.6 Maintain backward compatibility with existing job format
- [ ] 7.7 Add enhanced error messaging for API key-related failures

## 8. Frontend UI Components

- [ ] 8.1 Create ApiKeySection component for organization and project settings
- [ ] 8.2 Implement ApiKeyStatusDisplay component with resolution chain visualization
- [ ] 8.3 Create ApiKeyForm component with secure input handling
- [ ] 8.4 Add ProjectKeyResolutionChain component for project-specific status
- [ ] 8.5 Implement ApiKeyAuditLogs component for activity tracking
- [ ] 8.6 Integrate API key management into existing OrgDetail page
- [ ] 8.7 Integrate API key management into existing ProjectDetail page
- [ ] 8.8 Add proper form validation and error handling in UI

## 9. API Module and Dependency Configuration

- [ ] 9.1 Create ApiKeysModule with proper service exports
- [ ] 9.2 Update SynthesisModule to import ApiKeysModule
- [ ] 9.3 Update OrgsModule to import ApiKeysModule
- [ ] 9.4 Configure proper dependency injection for all services
- [ ] 9.5 Add ApiKeysModule to main AppModule

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