## ADDED Requirements

### Requirement: Auto-create MinIO bucket on startup
The system SHALL check for the existence of the `fabrick` MinIO bucket during application startup. If the bucket does not exist, the system SHALL create it before the application begins accepting requests. If the bucket already exists, the system SHALL proceed without error.

#### Scenario: Bucket does not exist at startup
- **WHEN** the application starts and the `fabrick` bucket does not exist in MinIO
- **THEN** the system creates the `fabrick` bucket and completes startup successfully

#### Scenario: Bucket already exists at startup
- **WHEN** the application starts and the `fabrick` bucket already exists in MinIO
- **THEN** the system proceeds without attempting to create the bucket and completes startup successfully

#### Scenario: MinIO is unreachable at startup
- **WHEN** the application starts and MinIO is not reachable
- **THEN** the system SHALL throw an error and fail to start
