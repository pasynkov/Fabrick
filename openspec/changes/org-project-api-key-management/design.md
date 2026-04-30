## Context

The current Fabrick synthesis system uses a single global ANTHROPIC_API_KEY environment variable shared across all organizations and projects. This approach lacks the flexibility needed for multi-tenant scenarios where organizations want to:

- Use their own Anthropic API keys for billing control
- Implement different API access patterns per project
- Track and audit API usage at organizational and project levels
- Maintain isolation between different customer workloads

Current synthesis flow:
- SynthesisProcessor initializes with global `process.env.ANTHROPIC_API_KEY`
- All synthesis jobs use the same API key regardless of organization or project
- No audit trail for API usage attribution

## Goals / Non-Goals

**Goals:**
- Implement hierarchical API key management (project → organization → global fallback)
- Secure storage of API keys using encryption with the global key as encryption secret
- Maintain backward compatibility with existing global API key configuration
- Add comprehensive audit logging for API key operations
- Provide intuitive UI for API key management in organization and project settings
- Validate Anthropic API keys format and basic connectivity

**Non-Goals:**
- Supporting other AI provider API keys (focus only on Anthropic)
- Real-time API usage tracking or billing integration
- API key rotation automation (manual management only)
- Multi-region API key distribution

## Decisions

### Decision 1: Hierarchical Resolution Strategy
**Choice:** Project API key → Organization API key → Global environment variable fallback
**Rationale:** Provides maximum flexibility while maintaining backward compatibility. Projects can override organization defaults, and the global key ensures existing setups continue working.
**Alternatives considered:**
- Flat project-only keys: Would require every project to have a key
- Organization-only keys: Lacks project-level flexibility

### Decision 2: Encryption Strategy
**Choice:** Use the global ANTHROPIC_API_KEY environment variable as encryption key via AES-256-GCM
**Rationale:** Leverages existing secure infrastructure. If someone has access to the environment variable, they already have API access. Provides protection against database compromise.
**Alternatives considered:**
- Separate encryption key: Additional key management complexity
- No encryption: Security risk if database is compromised
- Key derivation function: Over-engineering for current threat model

### Decision 3: Database Schema Design
**Choice:** Add nullable `anthropicApiKey` encrypted text columns to both organizations and projects tables
**Rationale:** Simple, straightforward schema that follows existing patterns. Nullable allows gradual adoption.
**Alternatives considered:**
- Separate API keys table: Over-engineering for single key type
- JSON configuration column: Less type-safe and harder to query

### Decision 4: API Key Validation Strategy
**Choice:** Format validation (sk-ant-apiXX- prefix) plus optional connectivity test
**Rationale:** Format validation catches most input errors. Connectivity test confirms the key works but is optional to avoid API calls during configuration.
**Alternatives considered:**
- Format-only validation: Misses invalid keys until synthesis
- Required connectivity test: Adds latency and API costs to configuration

### Decision 5: Audit Logging Approach
**Choice:** Log API key operations (set/update/delete) with hashed key identifiers, never log actual keys
**Rationale:** Provides audit trail for security while protecting sensitive data. Hash allows correlation without exposure.
**Alternatives considered:**
- No audit logging: Poor security posture
- Full key logging: Security risk
- Key prefix only: Limited correlation capability

### Decision 6: UI Integration Points
**Choice:** Add API key management sections to existing OrganizationDetail and ProjectDetail pages
**Rationale:** Integrates naturally with existing settings flows. Users expect to find API key settings in the organization/project configuration areas.
**Alternatives considered:**
- Separate API key management pages: Adds navigation complexity
- Global settings only: Doesn't support project-level keys

## Risks / Trade-offs

**Risk: Encryption key compromise** → Mitigation: Use environment variable that already provides API access; implement audit logging
**Risk: API key exposure in logs** → Mitigation: Strict logging guidelines to never log raw keys, only hashed identifiers
**Risk: Migration complexity** → Mitigation: Make new columns nullable, maintain backward compatibility
**Trade-off: Performance vs. security** → Encryption/decryption adds minimal overhead compared to network synthesis calls
**Trade-off: Complexity vs. flexibility** → Hierarchical resolution adds code complexity but provides essential multi-tenant flexibility
**Risk: Anthropic API key format changes** → Mitigation: Make validation configurable and fail gracefully on unknown formats