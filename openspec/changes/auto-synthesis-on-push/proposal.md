## Why

The current Fabrick system requires manual triggering of synthesis operations after code changes. This creates friction in the development workflow and can lead to outdated analysis results. Automating synthesis as part of the `fabrick push` command would ensure analysis stays current and reduce manual overhead.

## What Changes

- When auto-synthesis is enabled for a project, `fabrick push` automatically triggers synthesis after a successful push
- When auto-synthesis is disabled, `fabrick push` prompts the user: "Run synthesis?"
- Add configuration options for auto-synthesis behavior (enable/disable per project)
- Integrate with existing synthesis service architecture

## Capabilities

### New Capabilities
- `auto-synthesis-config`: Configuration management for per-project auto-synthesis settings

### Modified Capabilities
- `synthesis-service`: Extend existing synthesis service to handle automated job requests
- `fabrick-push-command`: Extend `fabrick push` CLI command to trigger synthesis automatically (when enabled) or prompt user (when disabled)

## Impact

- Backend API: New configuration endpoints
- Synthesis service: Extended job processing capabilities  
- Database: New table for auto-synthesis configuration
- User experience: Reduced manual steps in development workflow

Scope note: `synthesis-job-queue-optimization` extracted to separate proposal — see branch `proposal/77-synthesis-job-queue-optimization`
