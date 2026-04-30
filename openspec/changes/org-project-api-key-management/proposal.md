## Why

The Fabrick platform currently uses a single global ANTHROPIC_API_KEY environment variable for all synthesis operations. This creates several limitations:
- All users share the same API key, making it impossible to track usage by organization or project
- Organizations cannot use their own Anthropic API keys for cost control and billing management
- There's no way to isolate API usage between different organizations or projects
- No flexibility for different organizations to use different API key tiers or configurations

## What Changes

- Add encrypted anthropicApiKey fields to Organization and Project entities with database migrations
- Implement hierarchical API key resolution: project key → organization key (no global fallback)
- Add application-level encryption/decryption using the global ANTHROPIC_API_KEY as encryption key
- Implement Anthropic API key format validation (sk-ant-apiXX-XXXXX prefix check)
- Add audit logging for API key operations without exposing actual key values
- Create API endpoints for organization and project settings to manage API keys
- Build UI components for API key management in organization and project detail pages
- Update synthesis service to resolve and use the appropriate API key for each project
- Add comprehensive error handling when no valid API key is available

## Capabilities

### New Capabilities
- `api-key-encryption`: Application-level encryption service for secure API key storage
- `api-key-validation`: Anthropic API key format validation (prefix check only)
- `api-key-resolution`: Hierarchical API key resolution service (project → org, no global fallback)
- `audit-logging-api-keys`: Secure audit logging for API key operations without key exposure
- `org-settings-api`: API endpoints for organization API key management
- `project-settings-api`: API endpoints for project API key management
- `org-settings-ui`: UI components for managing organization API keys
- `project-settings-ui`: UI components for managing project API keys

### Modified Capabilities
- `db-migrations`: Add encrypted anthropicApiKey columns to organizations and projects tables
- `fabrick-synthesis`: Update synthesis service to resolve and use hierarchical API keys
- `organizational-structure`: Extend organization entity with encrypted API key storage
- `project-repo-management`: Extend project entity with encrypted API key storage

## Impact

- Database schema changes require migration for anthropicApiKey columns in organizations and projects tables
- Synthesis operations will resolve API keys hierarchically (project → org); synthesis will not start if no key is configured
- Organizations gain control over their Anthropic API usage and billing
- Project-level API keys allow fine-grained control and experimentation
- Enhanced security through encryption and audit logging
- UI updates in console application for API key management in org and project settings
- If no project or org API key is configured, synthesis is blocked with a user-facing prompt to configure a key