## ADDED Requirements

### Requirement: Release branches trigger ephemeral Azure environment creation
The staging workflow SHALL deploy a complete isolated Azure environment on every push to a `release/*` branch using Terraform. The environment MUST include: Functions API, PostgreSQL Flexible Server, Blob Storage, Service Bus, Container Apps (synthesis), and all Key Vault secrets.

#### Scenario: Push to release branch creates full Azure environment
- **WHEN** a commit is pushed to `release/x.y`
- **THEN** GitHub Actions runs `terraform apply -auto-approve` and all Fabrick Azure resources are provisioned in a staging resource group

#### Scenario: Staging environment uses unique resource names to avoid collision
- **WHEN** multiple release branches are active simultaneously
- **THEN** each environment uses distinct resource names (e.g., suffix from branch name or run ID) so they do not conflict

### Requirement: Staging environment is always destroyed after tests regardless of outcome
The staging workflow SHALL run `terraform destroy -auto-approve` in a `finally` step (GitHub Actions `if: always()`) after tests complete. Destruction MUST happen even if tests fail or the workflow is cancelled.

#### Scenario: Tests pass — environment destroyed
- **WHEN** user-journey tests pass
- **THEN** `terraform destroy` runs and all Azure resources are deleted

#### Scenario: Tests fail — environment destroyed and logs collected
- **WHEN** user-journey tests fail
- **THEN** logs are collected from Log Analytics and uploaded as a GitHub Actions artifact, then `terraform destroy` runs

#### Scenario: Workflow cancelled — environment destroyed
- **WHEN** the GitHub Actions workflow is manually cancelled
- **THEN** `terraform destroy` still runs via `if: always()` to prevent resource leaks

### Requirement: Staging failure logs are uploaded as GitHub Actions artifacts
On any test failure, the staging workflow SHALL collect API and synthesis logs from Azure Monitor and upload them as a downloadable artifact before destroying the environment.

#### Scenario: Logs uploaded on failure
- **WHEN** user-journey tests fail
- **THEN** a GitHub Actions artifact named `journey-failure-logs` is available containing API traces and synthesis container logs
