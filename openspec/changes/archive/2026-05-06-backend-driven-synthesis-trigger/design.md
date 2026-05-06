## Context

The current Fabrick synthesis system uses CLI-side logic to decide whether to trigger synthesis after a context upload. The CLI fetches project settings, checks `autoSynthesisEnabled`, and optionally prompts the user. This means the decision logic lives on the client side.

The existing architecture includes:
- `SynthesisService.triggerForProject` handles synthesis triggering with API key checking and org membership validation
- Queue-based job processing with JWT callback tokens
- Project-level auto-synthesis settings (`autoSynthesisEnabled` boolean flag)

## Goals / Non-Goals

**Goals:**
- Move synthesis trigger decision to the backend
- Add optional `triggerSynthesis` flag to context upload endpoint
- Backend triggers synthesis if `autoSynthesisEnabled` is true, or if `triggerSynthesis` flag is true
- CLI prompts user when `autoSynthesisEnabled` is false and passes flag in upload form

**Non-Goals:**
- New database tables or schema changes
- Scheduled or webhook-based triggers
- Async feedback or status polling from CLI
- Backward compatibility migration (not in production)

## Decisions

**Reuse `SynthesisService.triggerForProject`**
The existing method already validates org membership, API key availability, and publishes to the synthesis queue. Backend will call this method after context upload.

**Rationale:** No new synthesis logic needed. The issue explicitly states to use this existing method.

**Add `triggerSynthesis` boolean to context upload multipart form**
The `POST /repos/{repoId}/context` endpoint will accept an optional `triggerSynthesis` field alongside the file upload. A DTO with `@Transform` decorator handles string-to-boolean conversion from multipart form data.

**Rationale:** Author confirmed this approach in issue thread.

**Fire and forget semantics**
Synthesis trigger errors are caught and logged but do not fail the context upload response.

**Rationale:** Author explicitly stated "just fire and forget" with no async feedback needed.

## Risks / Trade-offs

**[Synthesis failure silent to CLI]** → Synthesis errors are logged server-side. This is acceptable per author's explicit decision.
