# Implementation Tasks

## Phase 1: Backend API Versioning

### Task 1.1: Enable NestJS Versioning
**Estimate**: 30 minutes
**Files**: `applications/backend/api/src/main.ts`, `applications/backend/api/src/main.azure.ts`

- [ ] Import `VersioningType` from `@nestjs/common`
- [ ] Add versioning configuration with default version 'v1'
- [ ] Update both local and Azure main files

### Task 1.2: Add Version Decorators to Controllers
**Estimate**: 45 minutes
**Files**: All controller files except `health.controller.ts`

- [ ] Add `@Version('1')` decorator to `AuthController`
- [ ] Add `@Version('1')` decorator to `OrgsController`  
- [ ] Add `@Version('1')` decorator to `ReposController`
- [ ] Add `@Version('1')` decorator to `SynthesisController`
- [ ] Add `@Version('1')` decorator to `ContextController`
- [ ] Add `@Version('1')` decorator to `SkillsController`
- [ ] Verify `HealthController` remains unversioned

### Task 1.3: Update Backend Tests
**Estimate**: 60 minutes
**Files**: All test files in `applications/backend/api/test/`

- [ ] Update auth.e2e.ts to use `/v1/auth` endpoints
- [ ] Update orgs.e2e.ts to use `/v1/orgs` endpoints
- [ ] Update repos.e2e.ts to use `/v1` prefixed endpoints
- [ ] Update synthesis.e2e.ts to use `/v1` prefixed endpoints
- [ ] Update context.e2e.ts to use `/v1` prefixed endpoints
- [ ] Ensure health.e2e.ts continues to use `/health` (unversioned)

## Phase 2: CLI Client Updates

### Task 2.1: Update CLI API Service
**Estimate**: 45 minutes
**Files**: `applications/cli/src/api.service.ts`

- [ ] Add version prefix logic to `request` method
- [ ] Keep health endpoints unversioned
- [ ] Add optional version configuration support
- [ ] Update method signatures if needed

### Task 2.2: Update CLI Configuration
**Estimate**: 15 minutes
**Files**: `applications/cli/src/config.js` or related config files

- [ ] Add optional `apiVersion` configuration parameter
- [ ] Default to 'v1' if not specified
- [ ] Document configuration option

### Task 2.3: Update CLI Tests
**Estimate**: 30 minutes
**Files**: `applications/cli/test/`, `applications/cli/src/*.spec.ts`

- [ ] Update API service tests for versioned endpoints
- [ ] Update integration tests to use `/v1` prefix
- [ ] Verify configuration parsing works correctly

## Phase 3: Console Client Updates

### Task 3.1: Update Console API Client
**Estimate**: 45 minutes
**Files**: `applications/console/src/api.ts`

- [ ] Add version prefix logic to `request` function
- [ ] Update all API endpoint calls to include `/v1`
- [ ] Maintain existing error handling and token refresh

### Task 3.2: Update Token Refresh Logic
**Estimate**: 15 minutes
**Files**: `applications/console/src/tokenRefresh.ts`

- [ ] Ensure refresh endpoints use versioned URLs
- [ ] Test token refresh flow with versioned API
- [ ] Verify session management compatibility

### Task 3.3: Update Console Tests
**Estimate**: 30 minutes
**Files**: Any test files in `applications/console/`

- [ ] Update API mocks to use versioned endpoints
- [ ] Test authentication flows with versioned API
- [ ] Verify error handling with version changes

## Phase 4: MCP Server Updates

### Task 4.1: Update MCP API Client
**Estimate**: 30 minutes
**Files**: `applications/mcp/src/api-client.ts`

- [ ] Add version parameter to `getSynthesisFile` function
- [ ] Add other synthesis-related API functions with version support
- [ ] Default to 'v1' for backward compatibility

### Task 4.2: Update MCP Tool Handlers
**Estimate**: 30 minutes
**Files**: `applications/mcp/src/index.ts`

- [ ] Update tool handlers to use versioned API functions
- [ ] Add version parameter to tool schemas
- [ ] Enhance error handling for version issues

### Task 4.3: Update MCP Tests
**Estimate**: 45 minutes
**Files**: `applications/mcp/src/*.test.ts`, `applications/mcp/test/`

- [ ] Update API client tests for versioned endpoints
- [ ] Test tool handlers with version parameters
- [ ] Add integration tests for version compatibility

## Dependencies and Ordering

### Critical Path
1. Task 1.1 → 1.2 → 1.3 (Backend versioning must be complete first)
2. Tasks 2.x, 3.x, 4.x can be done in parallel after Phase 1
3. Documentation and deployment procedures in separate proposal

### Coordination Requirements
- Backend deployment must happen before or simultaneously with client deployments
- All clients (CLI, Console, MCP) should be updated together
- Health endpoint changes require coordination with infrastructure monitoring

## Risk Mitigation

### High-Risk Tasks
- Task 1.2: Adding version decorators (could break existing functionality)
- Tasks 2.1, 3.1, 4.1: API client updates (could break client-server communication)

### Testing Strategy
- Comprehensive testing after each phase
- Integration testing before final deployment
- Rollback plan if version-related issues arise

### Validation Checklist
- [ ] All versioned endpoints return expected responses
- [ ] Health endpoint remains unversioned and functional
- [ ] Authentication and authorization work with versioned endpoints
- [ ] Client applications can authenticate and perform operations
- [ ] Token refresh flows work correctly
- [ ] Error handling provides clear messages for version issues
