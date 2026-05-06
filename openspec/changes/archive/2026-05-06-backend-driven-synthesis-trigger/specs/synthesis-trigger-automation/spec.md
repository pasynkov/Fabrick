## ADDED Requirements

### Requirement: Backend triggers synthesis on context upload
After a context file is stored, the backend SHALL check project settings and trigger synthesis automatically without requiring a separate CLI call.

#### Scenario: Auto-synthesis enabled — backend triggers automatically
- **WHEN** CLI uploads context to `POST /repos/{repoId}/context`
- **AND** project `autoSynthesisEnabled` is `true`
- **THEN** backend calls `SynthesisService.triggerForProject` after storing context
- **AND** synthesis trigger error does not fail the upload response

#### Scenario: Auto-synthesis disabled, user confirmed via flag
- **WHEN** CLI uploads context to `POST /repos/{repoId}/context` with `triggerSynthesis: true`
- **AND** project `autoSynthesisEnabled` is `false`
- **THEN** backend calls `SynthesisService.triggerForProject` after storing context
- **AND** synthesis trigger error does not fail the upload response

#### Scenario: Auto-synthesis disabled, no user confirmation
- **WHEN** CLI uploads context to `POST /repos/{repoId}/context` without `triggerSynthesis` flag (or `triggerSynthesis: false`)
- **AND** project `autoSynthesisEnabled` is `false`
- **THEN** backend stores context only and does not trigger synthesis

### Requirement: Fire and forget synthesis triggering
The context upload endpoint SHALL return its response without waiting for synthesis to complete.

#### Scenario: Synthesis trigger failure does not affect upload
- **WHEN** `SynthesisService.triggerForProject` throws an error
- **THEN** error is caught and logged
- **AND** context upload response is still returned successfully
