## Why

The current Fabrick system requires manual triggering of synthesis operations after code changes. This creates friction in the development workflow and can lead to outdated analysis results. An automated synthesis pipeline triggered on code push would ensure analysis stays current and reduce manual overhead.

## What Changes

- Add GitHub webhook endpoint to receive push notifications
- Implement automatic synthesis job queuing for repository changes
- Create background processing pipeline for synthesis operations
- Add configuration options for auto-synthesis behavior (enable/disable per project)
- Integrate with existing synthesis service architecture

## Capabilities

### New Capabilities
- `github-webhook-handler`: Endpoint to receive and process GitHub push webhook events
- `auto-synthesis-trigger`: Service to evaluate push events and trigger synthesis jobs automatically
- `synthesis-job-queue`: Enhanced queuing system for automatic synthesis operations
- `auto-synthesis-config`: Configuration management for per-project auto-synthesis settings

### Modified Capabilities
- `synthesis-service`: Extend existing synthesis service to handle automated job requests
- `fabrick-push-command`: Extend `fabrick push` CLI command to prompt user to run synthesis when auto-synthesis is disabled

## Impact

- Backend API: New webhook endpoints and background processing
- Synthesis service: Extended job processing capabilities  
- Database: New tables for auto-synthesis configuration and job tracking
- Infrastructure: Additional background processing resources
- User experience: Reduced manual steps in development workflow

Scope note: `synthesis-job-queue-optimization` extracted to separate proposal — see branch `proposal/77-synthesis-job-queue-optimization`
