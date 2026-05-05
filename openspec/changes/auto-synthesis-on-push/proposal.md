## Why

The current Fabrick system requires manual triggering of synthesis operations after code changes. This creates friction in the development workflow and can lead to outdated analysis results. Automating synthesis as part of the `fabrick push` command would ensure analysis stays current and reduce manual overhead.

## What Changes

- When auto-synthesis is enabled for a project, `fabrick push` automatically triggers synthesis after a successful push
- When auto-synthesis is disabled, `fabrick push` prompts the user: "Run synthesis?"
- Add `autoSynthesisEnabled` flag to the existing project DTO/settings (updated via the same endpoint as name and api key)
- Integrate with existing synthesis service architecture

## Capabilities

### Modified Capabilities
- `project-settings`: Add `autoSynthesisEnabled` flag to project DTO; allow updating it via the existing project settings endpoint
- `synthesis-service`: Extend existing synthesis service to handle automated job requests
- `fabrick-push-command`: Extend `fabrick push` CLI command to trigger synthesis automatically (when enabled) or prompt user (when disabled)

## Impact

- Backend API: Project DTO and settings endpoint extended with auto-synthesis flag
- Synthesis service: Extended job processing capabilities  
- Database: New column on existing projects table
- User experience: Reduced manual steps in development workflow

Scope note: `synthesis-job-queue-optimization` extracted to separate proposal — see branch `proposal/77-synthesis-job-queue-optimization`
