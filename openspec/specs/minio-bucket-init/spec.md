## Requirements

### Requirement: Auto-create storage container on demand
The system SHALL create an Azure Blob Storage container automatically on the first storage operation targeting that container, if it does not already exist. Container creation SHALL be lazy (per-operation), not eagerly on application startup.

#### Scenario: Container does not exist on first put
- **WHEN** `putObject` is called with a container that does not exist
- **THEN** the system creates the container and uploads the blob successfully

#### Scenario: Container already exists
- **WHEN** any storage operation targets an existing container
- **THEN** the system proceeds without attempting to create the container

#### Scenario: Storage service is unreachable
- **WHEN** the storage service is not reachable during any storage operation
- **THEN** the operation throws an error that propagates to the caller
