## Context

The Fabrick API currently has 22+ endpoints across Auth, Orgs, Repos, and Synthesis controllers with manual validation scattered throughout. Current validation patterns include:

```typescript
// Manual validation in controllers (current pattern)
if (!body.email || !body.password || body.password.length < 8) {
  throw new BadRequestException('email and password (min 8 chars) required');
}
if (!body.name || body.name.trim().length === 0) throw new BadRequestException('Name must not be empty');
```

The system also lacks role-based authorization for administrative operations like updating org/project names and adding members, allowing any authenticated user to perform these sensitive operations.

Current endpoint inventory requiring validation:
- **Auth Controller**: register, login, refresh, mcp-token (4 endpoints)
- **Orgs Controller**: create, addMember, updateName (3 endpoints) 
- **Repos Controller**: createProject, createRepo, findOrCreateRepo, updateProjectName, uploadContext (5 endpoints)
- **Synthesis Controller**: synthesisCallback, getSynthesisFile (2 endpoints)
- **Health/Skills Controllers**: Parameter validation for path/query params (8+ endpoints)

## Goals / Non-Goals

**Goals:**
- Implement comprehensive DTO-based validation using class-validator for all API endpoints
- Create role-based authorization with IsAdminGuard for administrative operations
- Standardize error responses using NestJS ValidationPipe global configuration
- Maintain backward compatibility with existing API contracts
- Improve security posture through proper input validation and authorization

**Non-Goals:**
- Changing existing API endpoint URLs or HTTP methods
- Implementing complex role hierarchies beyond admin/member distinction
- Adding password strength requirements (explicitly mentioned as no requirement)
- Modifying database schema for roles (using existing OrgMember.role field)

## Decisions

### Decision 1: Validation Library Choice
**Choice:** Use class-validator with class-transformer for DTO-based validation
**Rationale:** NestJS standard, provides declarative validation decorators, integrates seamlessly with ValidationPipe, and enables type-safe validation with TypeScript
**Alternatives considered:**
- Joi validation: Not type-safe, requires manual schema definition
- Custom validation: High maintenance overhead, reinvents wheel

### Decision 2: Global vs Local Validation Configuration  
**Choice:** Configure global ValidationPipe in main.ts with whitelist and forbidNonWhitelisted options
**Rationale:** Ensures consistent validation behavior across all endpoints, prevents property injection attacks, reduces boilerplate code
**Alternatives considered:**
- Per-controller validation: Inconsistent behavior, more maintenance
- Manual validation in each endpoint: Current problematic approach

### Decision 3: Admin Authorization Strategy
**Choice:** Create IsAdminGuard that checks OrgMember.role = 'admin' for the relevant organization
**Rationale:** Uses existing database schema, provides clear authorization boundaries, follows NestJS guard pattern
**Alternatives considered:**
- Permission-based system: Over-engineering for current requirements
- Hardcoded admin users: Not scalable, security risk

### Decision 4: DTO Organization Strategy
**Choice:** Create dedicated DTO files per controller with clear naming (CreateOrgDto, UpdateOrgNameDto, etc.)
**Rationale:** Clear separation of concerns, easy to maintain, follows NestJS conventions
**Alternatives considered:**  
- Single DTO file: Would become unwieldy
- Inline interfaces: Lose validation decorators

### Decision 5: Admin Guard Application Strategy
**Choice:** Apply IsAdminGuard specifically to: updateName (orgs), addMember (orgs), updateProjectName (repos)
**Rationale:** These are the sensitive administrative operations identified in requirements; other operations (create, list) remain accessible to all members
**Alternatives considered:**
- Guard all org operations: Too restrictive for collaborative use
- No authorization: Current security gap

## Risks / Trade-offs

**Risk: Breaking existing API clients** → Mitigation: Maintain backward compatibility by not changing response formats, only adding validation
**Risk: Performance impact from validation overhead** → Mitigation: class-validator is optimized, validation happens before business logic
**Risk: Admin guard complexity with multi-org scenarios** → Mitigation: Guard extracts orgId from request params/body to check correct organization membership
**Trade-off: Validation strictness vs flexibility** → Chose strict whitelist validation to prevent injection attacks, may require explicit DTO properties for all fields
**Trade-off: Centralized vs distributed authorization** → IsAdminGuard provides centralized logic but requires proper context passing from controllers