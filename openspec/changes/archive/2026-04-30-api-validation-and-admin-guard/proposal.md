## Why

The Fabrick API currently lacks consistent input validation and proper authorization controls for administrative operations. This creates security vulnerabilities and inconsistent error handling:

- Manual validation scattered across 22+ endpoints with inconsistent error responses
- No role-based access control for sensitive operations like org/project name updates and member management
- Security gaps where non-admin users can potentially modify organizational structure
- Poor user experience due to inconsistent validation error formats and messaging

The lack of centralized validation also makes the codebase harder to maintain, with validation logic duplicated across controllers and missing validation for critical endpoints.

## What Changes

- Install and configure class-validator and class-transformer for standardized input validation
- Create DTO classes for all API endpoints (Auth, Orgs, Repos, Synthesis controllers)
- Implement IsAdminGuard to enforce role-based access control for administrative operations
- Configure global ValidationPipe in main.ts for consistent error handling
- Replace manual validation scattered throughout controllers with declarative DTO-based validation
- Apply admin guard to sensitive endpoints: updateName, addMember, updateProjectName

## Capabilities

### New Capabilities
- `input-validation`: DTO-based validation for all API endpoints using class-validator decorators
- `admin-guard`: Role-based access control guard that verifies admin role from OrgMember table
- `validation-pipeline`: Global validation configuration with standardized NestJS error responses

### Modified Capabilities
- `user-auth`: Enhanced with proper email format validation and secure password handling
- `org-management`: Protected admin operations (updateName, addMember) with role validation
- `project-repo-management`: Protected project name updates with admin role enforcement

## Impact

- All API endpoints will have consistent input validation with standardized error responses
- Administrative operations will be properly secured with role-based access control
- Validation errors will follow NestJS standard format for better client integration
- Code maintainability improved through centralized validation logic
- Enhanced security posture with proper authorization controls for sensitive operations
- Better user experience with consistent, clear validation error messages