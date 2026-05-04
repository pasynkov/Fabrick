## MODIFIED Requirements

### Requirement: Enhanced synthesis service API key resolution with caching
The system SHALL integrate enhanced API key resolution with the synthesis service including caching and error reporting. No fallback to environment variables.

#### Scenario: Cached API key resolution for synthesis operations
- **WHEN** synthesis service resolves API keys for projects
- **THEN** the system uses cached resolution results when available and falls back to database queries with performance monitoring

#### Scenario: Error handling for missing API keys
- **WHEN** synthesis operations encounter missing or invalid API keys
- **THEN** the service fails the synthesis job with an error message that includes a direct link to the project settings form

#### Scenario: API key health validation before synthesis
- **WHEN** resolving API keys for synthesis operations
- **THEN** the system validates key health and warns of potential issues before queuing synthesis jobs

### Requirement: Synthesis job API key context and monitoring
The system SHALL provide enhanced API key context in synthesis jobs with detailed monitoring and usage tracking.

#### Scenario: API key source tracking in synthesis jobs
- **WHEN** synthesis jobs are executed with resolved API keys
- **THEN** the system tracks and logs the API key source (project vs organization) for usage analysis

#### Scenario: Synthesis operation monitoring by API key source
- **WHEN** monitoring synthesis operations
- **THEN** the system provides metrics and monitoring grouped by API key source and organization for cost tracking

#### Scenario: API key usage analytics for synthesis
- **WHEN** analyzing synthesis API key usage
- **THEN** the system provides analytics on usage patterns, success rates, and performance by API key source

### Requirement: Synthesis service error handling for API key failures
The system SHALL implement proper error handling in synthesis service for API key-related failures. No fallback mechanisms — failures are surfaced explicitly.

#### Scenario: API key resolution failure handling
- **WHEN** API key resolution fails during synthesis operations
- **THEN** the system fails the job with a clear error message (including a direct link to settings) without cascading failures

#### Scenario: API key expiration handling in synthesis
- **WHEN** API keys become invalid during ongoing synthesis operations
- **THEN** the system detects key issues and provides clear error reporting with guidance for resolution

#### Scenario: Synthesis queue management for API key issues
- **WHEN** API key problems affect multiple synthesis jobs
- **THEN** the system manages job queues appropriately and prevents resource exhaustion from failed key resolution