## ADDED Requirements

### Requirement: API deploys automatically on merge to main
The CD system SHALL deploy the NestJS API to Azure Functions automatically when a commit is pushed to `main`. Deployment MUST use `func azure functionapp publish` with production dependencies only. Deployment SHALL fail the workflow if the function app does not become healthy within a timeout period.

#### Scenario: Merge to main triggers API deploy
- **WHEN** a pull request is merged to `main`
- **THEN** GitHub Actions publishes the API to Azure Functions using the stored publish profile

#### Scenario: Deploy fails on build error
- **WHEN** `npm ci --omit=dev` fails or the build step fails
- **THEN** the workflow fails before attempting to publish to Azure

### Requirement: Synthesis worker deploys automatically on merge to main
The CD system SHALL build and push a new synthesis Docker image to ACR and update the Container App on merge to `main`. Build MUST target `linux/amd64` platform regardless of the runner architecture.

#### Scenario: Merge to main triggers synthesis image build and push
- **WHEN** a pull request is merged to `main`
- **THEN** GitHub Actions builds the synthesis image with `--platform linux/amd64`, pushes to ACR, and updates the Container App to use the new image

#### Scenario: Deploy uses system-managed identity for ACR pull
- **WHEN** the Container App is updated to a new image
- **THEN** the Container App pulls the image using its system-assigned managed identity, not stored credentials

### Requirement: CD deploy requires all CI checks to pass before triggering
The CD workflow SHALL only run after the commit on `main` has passing unit and e2e CI checks. It MUST NOT deploy from a commit where tests failed.

#### Scenario: CD blocked if tests not green
- **WHEN** a commit is pushed to main (e.g., via direct push bypassing PR)
- **THEN** CD workflow SHALL fail or skip if required status checks are not passing on that commit
