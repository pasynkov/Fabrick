# Implementation Tasks

## Phase 1: Backend API Versioning

### Task 1.1: Enable NestJS Versioning
**Estimate**: 30 minutes
**Files**: `applications/backend/api/src/main.ts`, `applications/backend/api/src/main.azure.ts`

- [x] Import `VersioningType` from `@nestjs/common`
- [x] Add versioning configuration with default version 'v1'
- [x] Update both local and Azure main files

### Task 1.2: Add Version Decorators to Controllers
**Estimate**: 45 minutes
**Files**: All controller files except `health.controller.ts`

- [x] Add `@Version('1')` decorator to `AuthController`
- [x] Add `@Version('1')` decorator to `OrgsController`  
- [x] Add `@Version('1')` decorator to `ReposController`
- [x] Add `@Version('1')` decorator to `SynthesisController`
- [x] Add `@Version('1')` decorator to `ContextController`
- [x] Add `@Version('1')` decorator to `SkillsController`
- [x] Verify `HealthController` remains unversioned

### Task 1.3: Update Backend Tests
**Estimate**: 60 minutes
**Files**: All test files in `applications/backend/api/test/`

- [x] Update auth.e2e.ts to use `/v1/auth` endpoints
- [x] Update orgs.e2e.ts to use `/v1/orgs` endpoints
- [x] Update repos.e2e.ts to use `/v1` prefixed endpoints
- [x] Update synthesis.e2e.ts to use `/v1` prefixed endpoints
- [x] Update context.e2e.ts to use `/v1` prefixed endpoints
- [x] Ensure health.e2e.ts continues to use `/health` (unversioned)

## Phase 2: CLI Client Updates

### Task 2.1: Update CLI API Service
**Estimate**: 45 minutes
**Files**: `applications/cli/src/api.service.ts`

- [x] Add `/v1` prefix logic to `request` method
- [x] Keep health endpoints unversioned

### Task 2.2: Update CLI Tests
**Estimate**: 30 minutes
**Files**: `applications/cli/test/`, `applications/cli/src/*.spec.ts`

- [x] Update API service tests for versioned endpoints
- [x] Update integration tests to use `/v1` prefix

## Phase 3: Console Client Updates

### Task 3.1: Update Console API Client
**Estimate**: 45 minutes
**Files**: `applications/console/src/api.ts`

- [x] Add version prefix logic to `request` function
- [x] Update all API endpoint calls to include `/v1`
- [x] Maintain existing error handling and token refresh

### Task 3.2: Update Token Refresh Logic
**Estimate**: 15 minutes
**Files**: `applications/console/src/tokenRefresh.ts`

- [x] Ensure refresh endpoints use versioned URLs
- [x] Test token refresh flow with versioned API
- [x] Verify session management compatibility

### Task 3.3: Update Console Tests
**Estimate**: 30 minutes
**Files**: Any test files in `applications/console/`

- [x] Update API mocks to use versioned endpoints
- [x] Test authentication flows with versioned API
- [x] Verify error handling with version changes

## Phase 4: MCP Server Updates

### Task 4.1: Update MCP API Client
**Estimate**: 30 minutes
**Files**: `applications/mcp/src/api-client.ts`

- [x] Update `getSynthesisFile` to use `/v1` prefix in URL

### Task 4.2: Update MCP Tool Handlers
**Estimate**: 30 minutes
**Files**: `applications/mcp/src/index.ts`

- [x] Update tool handlers to use updated versioned API functions

### Task 4.3: Update MCP Tests
**Estimate**: 45 minutes
**Files**: `applications/mcp/src/*.test.ts`, `applications/mcp/test/`

- [x] Update API client tests for versioned endpoints
- [x] Test tool handlers with versioned API

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
- [x] All versioned endpoints return expected responses
- [x] Health endpoint remains unversioned and functional
- [x] Authentication and authorization work with versioned endpoints
- [x] Client applications can authenticate and perform operations
- [x] Token refresh flows work correctly
- [x] Error handling provides clear messages for version issues
