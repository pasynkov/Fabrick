## Context

The current Fabrick synthesis system uses a manual trigger approach where users initiate synthesis through CLI commands (`fabrick push` with synthesis flag) or console interactions. The synthesis service receives jobs through a queue system and processes them asynchronously. Currently, there's basic auto-synthesis support when enabled at the project level, but it's limited to push-based triggering.

The existing architecture includes:
- `SynthesisService` handles manual trigger requests
- Queue-based job processing with JWT callback tokens
- Project-level auto-synthesis settings (boolean flag)
- API key resolution and audit logging

## Goals / Non-Goals

**Goals:**
- Enable automatic synthesis triggering based on multiple event types (push, schedule, external webhooks)
- Provide configurable trigger conditions and rules per project
- Maintain backward compatibility with existing manual triggering
- Support multiple trigger types: immediate, scheduled, conditional
- Integrate seamlessly with existing synthesis queue and processing infrastructure

**Non-Goals:**
- Real-time synthesis (queue-based async processing remains unchanged)
- Complex workflow orchestration beyond trigger automation
- External CI/CD system integration in this phase
- Historical trigger analytics or reporting

## Decisions

**Event-Driven Architecture with Trigger Registry**
We'll implement a trigger registry pattern where projects can register multiple triggers with different conditions. Each trigger type implements a common interface but handles its own scheduling and condition evaluation.

**Rationale:** This approach allows for extensible trigger types while maintaining clear separation of concerns. Alternative considered was a single monolithic trigger service, but that would be harder to extend and test.

**Database Schema Extension**
Add new tables: `synthesis_triggers` (trigger configurations) and `synthesis_trigger_logs` (execution history). Link to existing project entity.

**Rationale:** Separate tables allow for complex trigger configurations without polluting the project schema. Alternative was extending the project table, but trigger data is too complex for simple columns.

**Reuse Existing Synthesis Queue**
Automated triggers will publish jobs to the same `synthesis-jobs` queue used by manual triggers, with additional metadata to distinguish trigger source.

**Rationale:** Maintains consistency with existing synthesis processing and avoids duplicating queue infrastructure. Risk: potential queue congestion with automated triggers, mitigated by rate limiting.

**Trigger Types Implementation**
- `PUSH_TRIGGER`: React to repository push events (extends current auto-synthesis)
- `SCHEDULE_TRIGGER`: Cron-based scheduling
- `WEBHOOK_TRIGGER`: External webhook integration (future-ready)

## Risks / Trade-offs

**[Queue Overload]** → Implement per-project rate limiting and global synthesis queue monitoring. Add circuit breaker patterns for automated triggers.

**[Resource Consumption]** → Scheduled triggers could consume significant compute resources. Mitigation: add project-level limits and admin controls for trigger frequency.

**[Configuration Complexity]** → Multiple trigger types increase UI/UX complexity. Mitigation: progressive disclosure in console interface, starting with simple on/off toggles.

**[Backward Compatibility]** → Changes to synthesis service could break existing manual workflows. Mitigation: maintain existing API contracts and add new endpoints for trigger management.

**[Failed Trigger Handling]** → Automated triggers might fail silently. Mitigation: comprehensive logging, retry logic, and optional notification system for trigger failures.

## Migration Plan

1. **Phase 1**: Database schema changes and trigger infrastructure
2. **Phase 2**: API endpoints for trigger management
3. **Phase 3**: Console UI integration
4. **Phase 4**: Enable automated triggers (feature flag controlled)

**Rollback Strategy**: Database changes are additive, trigger functionality can be disabled via feature flags without affecting manual synthesis.