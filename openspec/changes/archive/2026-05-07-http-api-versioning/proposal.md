## Why

The Fabrick API currently has no versioning strategy, which makes it difficult to evolve the API without breaking existing clients. As the platform grows and new features are added, we need a clear versioning approach to maintain backward compatibility and enable smooth client migrations.

## What Changes

- Implement NestJS URI versioning strategy with `/v1` prefix for all API endpoints
- Keep `/health` endpoint unversioned for infrastructure monitoring
- Set v1 as the default version for all existing functionality
- Update CLI, Console, and MCP clients to use versioned endpoints
- No backward compatibility layer needed since this is the initial versioning implementation

## Capabilities

### New Capabilities

- `api-versioning`: URI-based API versioning using NestJS versioning decorators

### Modified Capabilities

- All API endpoints now prefixed with `/v1` except `/health`
- CLI, Console, and MCP clients updated to use versioned API endpoints

## Impact

- All API endpoints move from `/endpoint` to `/v1/endpoint` (except `/health`)
- Existing clients must be updated to use versioned endpoints
- Future API changes can use new versions (v2, v3, etc.) without breaking v1 clients
- Infrastructure health checks remain unversioned for compatibility
- No data migration required - only endpoint URL changes

Scope note: `api-versioning-deployment-documentation` extracted to separate proposal — see branch `proposal/99-api-versioning-deployment-documentation`
