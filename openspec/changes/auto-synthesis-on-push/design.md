## Context

Fabrick currently has a synthesis service that analyzes code and generates insights, but it requires manual triggering through CLI commands or console interactions. The existing synthesis architecture includes:

- Backend API with synthesis endpoints
- Separate synthesis service for processing jobs
- NATS/Service Bus queue system for job management
- Storage integration for context and results

Users must remember to manually run synthesis after code changes, leading to stale analysis and workflow friction.

## Goals / Non-Goals

**Goals:**
- Automatically trigger synthesis when code is pushed to GitHub repositories
- Maintain existing synthesis quality and processing capabilities
- Allow per-project configuration of auto-synthesis behavior
- Integrate seamlessly with existing synthesis service architecture
- Provide reliable webhook processing with proper error handling

**Non-Goals:**
- Real-time synthesis (acceptable to have processing delay)
- Complex branching logic or per-branch synthesis rules initially
- Integration with other Git providers beyond GitHub
- Modification of core synthesis algorithms or output formats

## Decisions

### Webhook Architecture
**Decision:** Add webhook endpoints to the existing backend API service rather than creating a separate webhook service.
**Rationale:** Leverages existing authentication, logging, and error handling infrastructure. Simpler deployment and maintenance.
**Alternative considered:** Standalone webhook service was rejected due to added complexity and duplication of auth/logging logic.

### Job Processing Strategy
**Decision:** Enhance existing NATS/Service Bus queue system to handle auto-triggered jobs.
**Rationale:** Reuses proven queue infrastructure and synthesis processing logic. Auto-triggered jobs follow same processing path as manual jobs.
**Alternative considered:** Direct synthesis invocation was rejected due to loss of queue benefits (retry, monitoring, backpressure).

### Configuration Storage
**Decision:** Store auto-synthesis settings in existing PostgreSQL database with new tables linked to projects.
**Rationale:** Maintains transactional consistency with project data and leverages existing database infrastructure.
**Alternative considered:** Redis/cache storage was rejected due to persistence requirements and complexity of cache invalidation.

### Event Filtering
**Decision:** Process all push events but add intelligent filtering based on changed files and project configuration.
**Rationale:** Ensures no important changes are missed while allowing optimization for irrelevant commits (docs-only, config-only).
**Alternative considered:** GitHub webhook filtering was rejected as too limiting for future feature expansion.

## Risks / Trade-offs

**Webhook reliability** → Implement webhook signature verification, idempotency handling, and dead letter queue for failed processing

**Increased synthesis load** → Add project-level rate limiting and allow users to disable auto-synthesis per project

**Large repository processing** → Implement incremental synthesis based on changed files rather than full repo analysis

**Queue backpressure** → Monitor queue depth and implement overflow handling to prevent system overload

**GitHub API rate limits** → Cache repository metadata and use webhook payload data to minimize API calls