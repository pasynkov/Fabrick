## MODIFIED Requirements

### Requirement: Auto-create MinIO bucket on org creation
The system SHALL create a MinIO bucket named after the org slug when a new Organization is created. Bucket name SHALL match `^[a-z0-9-]{3,63}$`. If the bucket already exists, proceed without error.

#### Scenario: Org created — bucket created
- **WHEN** a new organization is created with slug `acme-corp`
- **THEN** the system creates MinIO bucket `acme-corp`

#### Scenario: Bucket already exists
- **WHEN** an org is created but the bucket already exists in MinIO
- **THEN** the system proceeds without error

#### Scenario: MinIO is unreachable during org creation
- **WHEN** MinIO is not reachable when creating an org
- **THEN** the system returns HTTP 503 and does not commit the org to the database

## REMOVED Requirements

### Requirement: Auto-create MinIO bucket on startup
**Reason**: Replaced by per-org bucket creation. There is no longer a single `fabrick` bucket.
**Migration**: Remove the startup bucket creation logic. Buckets are now created per-org via OrgService.
