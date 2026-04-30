## 1. Package Dependencies and Configuration

- [x] 1.1 Install class-validator and class-transformer as production dependencies
- [x] 1.2 Configure global ValidationPipe in main.ts with whitelist, forbidNonWhitelisted, and transform options
- [x] 1.3 Update package.json with new dependencies and verify compatibility with existing NestJS version

## 2. Auth Controller DTOs and Validation

- [x] 2.1 Create RegisterDto with @IsEmail() for email, @IsString() for password, @IsOptional() @IsBoolean() for persistent
- [x] 2.2 Create LoginDto with @IsEmail() for email, @IsString() for password, @IsOptional() @IsBoolean() for persistent  
- [x] 2.3 Create RefreshTokenDto with @IsString() for refresh_token
- [x] 2.4 Create McpTokenDto with @IsString() for orgSlug, projectSlug, and repoId
- [x] 2.5 Update AuthController to use DTOs instead of inline interfaces for all endpoints
- [x] 2.6 Remove manual validation logic from auth controller methods

## 3. Organizations Controller DTOs and Validation

- [x] 3.1 Create CreateOrgDto with @IsString() @IsNotEmpty() @MaxLength(128) for name
- [x] 3.2 Create AddMemberDto with @IsEmail() for email, @IsString() for password
- [x] 3.3 Create UpdateOrgNameDto with @IsString() @IsNotEmpty() @MaxLength(128) @Transform(trim) for name
- [x] 3.4 Update OrgsController to use DTOs and remove manual validation
- [x] 3.5 Add @Body() with DTO types to all org controller methods

## 4. IsAdminGuard Implementation

- [x] 4.1 Create IsAdminGuard class implementing CanActivate interface
- [x] 4.2 Implement organization context extraction from request parameters (orgId, projectId lookup)
- [x] 4.3 Add database query to verify user role='admin' in OrgMember table for relevant organization
- [x] 4.4 Implement proper error handling with HTTP 403 for insufficient permissions
- [x] 4.5 Add unit tests for IsAdminGuard with various scenarios (admin, member, non-member)

## 5. Apply Admin Guard to Protected Endpoints

- [x] 5.1 Apply @UseGuards(IsAdminGuard) to PATCH /orgs/:orgId (updateName) method
- [x] 5.2 Apply @UseGuards(IsAdminGuard) to POST /orgs/:orgId/members (addMember) method  
- [x] 5.3 Apply @UseGuards(IsAdminGuard) to PATCH /orgs/:orgId/projects/:projectId (updateProjectName) method
- [x] 5.4 Ensure guard is applied after FabrickAuthGuard to maintain authentication requirement
- [x] 5.5 Test admin guard functionality with different user roles

## 6. Repos Controller DTOs and Validation

- [x] 6.1 Create CreateProjectDto with @IsString() @IsNotEmpty() @MaxLength(128) for name
- [x] 6.2 Create CreateRepoDto with @IsString() @IsNotEmpty() for name, @IsUrl() for gitRemote
- [x] 6.3 Create FindOrCreateRepoDto with @IsUrl() for gitRemote, @IsUuid() for projectId
- [x] 6.4 Create UpdateProjectNameDto with @IsString() @IsNotEmpty() @MaxLength(128) @Transform(trim) for name
- [x] 6.5 Update ReposController to use DTOs and remove manual validation
- [x] 6.6 Add proper validation for file upload in uploadContext method

## 7. Synthesis Controller DTOs and Validation

- [x] 7.1 Create SynthesisCallbackDto with @IsString() for projectId, @IsString() for status, @IsOptional() @IsString() for error
- [x] 7.2 Add query parameter validation for getSynthesisFile method with @Query() decorators
- [x] 7.3 Update SynthesisController to use DTOs for callback endpoint
- [x] 7.4 Add @IsUuid() validation for ID parameters across synthesis endpoints

## 8. Parameter and Query Validation

- [x] 8.1 Add @Param() decorators with UUID validation for all ID parameters (orgId, projectId, repoId)
- [x] 8.2 Create ParamValidationPipe for UUID format validation
- [x] 8.3 Add @Query() decorators with validation for query parameters (path, etc.)
- [x] 8.4 Update all controllers to use validated parameters instead of raw string parameters

## 9. Error Handling and Response Standardization

- [x] 9.1 Configure ValidationPipe to use NestJS standard error format
- [x] 9.2 Update any custom error handling to maintain consistent response format
- [x] 9.3 Add proper error messages for admin guard authorization failures
- [x] 9.4 Test error response format consistency across all endpoints

## 10. Testing and Validation

- [x] 10.1 Update existing unit tests to account for validation changes
- [x] 10.2 Add integration tests for DTO validation scenarios (valid/invalid inputs)
- [x] 10.3 Add tests for IsAdminGuard with different user roles and organizations
- [x] 10.4 Test error response formats match NestJS standards
- [x] 10.5 Verify backward compatibility with existing API clients

## 11. Documentation and Cleanup

- [x] 11.1 Remove all manual validation logic replaced by DTOs
- [x] 11.2 Update API documentation with new validation requirements
- [x] 11.3 Clean up unused validation utility functions
- [x] 11.4 Verify all endpoints have appropriate validation coverage