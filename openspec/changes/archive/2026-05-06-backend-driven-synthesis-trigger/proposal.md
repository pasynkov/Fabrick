## Why

The current synthesis triggering is handled on the CLI side. Moving the decision logic to the backend enables consistent behavior across different clients and allows the backend to respect project settings directly.

## What Changes

- Extend the context upload endpoint to accept an optional `triggerSynthesis` flag
- Update ReposController to check project's `autoSynthesisEnabled` setting
- Trigger synthesis automatically if `autoSynthesisEnabled` is true or if user provides `triggerSynthesis` flag
- Remove synthesis triggering logic from CLI after context upload

## Capabilities

### New Capabilities
- `backend-driven-synthesis`: Backend-side synthesis triggering based on project settings and user confirmation

### Modified Capabilities
- `fabrick-synthesis`: Enhanced to support backend-driven triggering

## Impact

- `applications/backend/api/src/repos/` - ReposController context upload logic
- `applications/backend/api/src/repos/dto/` - Upload context DTO with optional triggerSynthesis field
- `applications/cli/src/` - Remove synthesis handling from push command
- Synthesis triggering now respects project settings at backend

