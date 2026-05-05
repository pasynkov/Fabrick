## Context

Fabrick currently has a synthesis service that analyzes code and generates insights, but it requires manual triggering through CLI commands or console interactions. The existing synthesis architecture includes:

- Backend API with synthesis endpoints
- Separate synthesis service for processing jobs
- NATS/Service Bus queue system for job management
- Storage integration for context and results

Users must remember to manually run synthesis after code changes, leading to stale analysis and workflow friction.

## Goals / Non-Goals

**Goals:**
- Automatically trigger synthesis when `fabrick push` is used (when auto-synthesis setting is enabled)
- Prompt user to run synthesis during `fabrick push` when auto-synthesis is disabled
- Maintain existing synthesis quality and processing capabilities
- Allow per-project configuration of auto-synthesis behavior (on/off)
- Integrate seamlessly with existing synthesis service architecture

**Non-Goals:**
- Real-time synthesis (acceptable to have processing delay)
- Complex branching logic or per-branch synthesis rules initially
- Integration with GitHub webhooks or push notifications
- Modification of core synthesis algorithms or output formats

## Decisions

### Trigger Mechanism
**Decision:** Synthesis is triggered directly by the `fabrick push` CLI command, not by GitHub webhooks.
**Rationale:** The author explicitly requested this to be CLI-driven via `fabrick push`. No external webhook infrastructure is needed.

### Job Processing Strategy
**Decision:** Use existing NATS/Service Bus queue system as-is to handle auto-triggered jobs.
**Rationale:** Reuses proven queue infrastructure and synthesis processing logic. Auto-triggered jobs follow same processing path as manual jobs.
**Alternative considered:** Direct synthesis invocation was rejected due to loss of queue benefits (retry, monitoring, backpressure).

### Configuration Storage
**Decision:** Add `auto_synthesis_enabled` column to the existing projects table; expose it via the project DTO and allow updating it through the existing project settings endpoint (alongside name and api key).
**Rationale:** Keeps configuration co-located with the project record, avoids a new table and new endpoints, and reuses existing update flow.

### `fabrick push` CLI Behavior
**Decision:** When auto-synthesis is enabled, `fabrick push` triggers synthesis automatically after a successful push. When auto-synthesis is disabled, CLI prompts: "Run synthesis?" If user confirms, a flag is sent to trigger synthesis using the same flow as manual triggers.
**Rationale:** Author added this requirement explicitly: "if automatically run synthesis is off and user uses fabrick push command we should ask him Run synthesis?"

## Risks / Trade-offs

**Large repository processing** → Uses same flow as manual synthesis; no special optimization required

**Queue backpressure** → Monitor queue depth and implement overflow handling to prevent system overload
