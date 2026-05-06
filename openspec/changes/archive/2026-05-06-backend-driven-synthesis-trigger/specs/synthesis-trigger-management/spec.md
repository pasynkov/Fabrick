## MODIFIED Requirements

### Requirement: Context upload endpoint accepts optional triggerSynthesis flag
The `POST /repos/{repoId}/context` endpoint SHALL accept an optional `triggerSynthesis` boolean field in the multipart form body.

#### Scenario: Upload with triggerSynthesis flag
- **WHEN** client sends multipart form with file and `triggerSynthesis: "true"`
- **THEN** endpoint accepts request and `triggerSynthesis` is parsed as `true`

#### Scenario: Upload without triggerSynthesis flag
- **WHEN** client sends multipart form with file only (no `triggerSynthesis` field)
- **THEN** endpoint accepts request and `triggerSynthesis` defaults to `false`

### Requirement: CLI prompts user when auto-synthesis is disabled
When `autoSynthesisEnabled` is `false`, the CLI SHALL prompt the user before uploading context and include the user's decision in the upload request.

#### Scenario: User confirms synthesis when disabled
- **WHEN** CLI detects `autoSynthesisEnabled: false` before upload
- **AND** user confirms synthesis prompt
- **THEN** CLI uploads context with `triggerSynthesis: true` in form data

#### Scenario: User declines synthesis when disabled
- **WHEN** CLI detects `autoSynthesisEnabled: false` before upload
- **AND** user declines synthesis prompt
- **THEN** CLI uploads context without `triggerSynthesis` flag (or `triggerSynthesis: false`)

#### Scenario: Auto-synthesis enabled — no prompt needed
- **WHEN** CLI detects `autoSynthesisEnabled: true`
- **THEN** CLI uploads context without `triggerSynthesis` flag (backend handles it automatically)

### Requirement: CLI removes standalone synthesis trigger call
The CLI SHALL NOT make a separate call to `POST /projects/{projectId}/synthesis` after context upload.

#### Scenario: Push command completes after context upload
- **WHEN** `fabrick push` completes context upload
- **THEN** no separate synthesis endpoint is called
- **AND** synthesis is handled entirely by the backend
