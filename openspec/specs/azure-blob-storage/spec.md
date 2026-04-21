## Requirements

### Requirement: Object storage via Azure Blob Storage
The system SHALL use `@azure/storage-blob` to store and retrieve objects. The storage interface SHALL expose three methods: `putObject(container, key, buffer)`, `getObject(container, key) → Buffer`, and `listObjects(container, prefix) → string[]`. Container name equals the orgSlug passed by callers.

#### Scenario: Put object
- **WHEN** `putObject` is called with a container name, key, and buffer
- **THEN** the system creates the container if it does not exist and uploads the blob

#### Scenario: Get object
- **WHEN** `getObject` is called with a container name and key
- **THEN** the system returns the blob content as a Buffer

#### Scenario: List objects by prefix
- **WHEN** `listObjects` is called with a container name and prefix string
- **THEN** the system returns all blob names in that container matching the prefix

### Requirement: Azure Storage connection via single env var
The system SHALL read `AZURE_STORAGE_CONNECTION_STRING` to configure the storage client. No other storage-related env vars SHALL be required.

#### Scenario: Valid connection string present
- **WHEN** `AZURE_STORAGE_CONNECTION_STRING` is set in the environment
- **THEN** the storage client connects successfully

#### Scenario: Connection string absent
- **WHEN** `AZURE_STORAGE_CONNECTION_STRING` is not set
- **THEN** the application fails to start with a clear error

### Requirement: Azurite used for local development
The system SHALL use Azurite (`mcr.microsoft.com/azure-storage/azurite`) as the local Azure Blob Storage emulator in docker-compose, replacing MinIO.

#### Scenario: Local docker-compose startup
- **WHEN** `docker-compose up` is run locally
- **THEN** Azurite starts on port 10000 and the API/synthesis services connect to it via the standard Azurite connection string

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
