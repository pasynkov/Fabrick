## ADDED Requirements

### Requirement: Support automated trigger source identification
The synthesis service SHALL process jobs triggered automatically with proper source attribution and logging.

#### Scenario: Automated trigger job processing
- **WHEN** synthesis service receives job with `triggerSource: "PUSH_TRIGGER"` metadata
- **THEN** job is processed normally and trigger source is logged in synthesis output

#### Scenario: Manual vs automated trigger differentiation
- **WHEN** synthesis service processes both manual and automated trigger jobs
- **THEN** processing quality and output format remain identical regardless of trigger source

### Requirement: Enhanced queue message support for triggers
The synthesis service SHALL accept enhanced queue messages containing trigger metadata without breaking existing manual trigger functionality.

#### Scenario: Queue message with trigger metadata
- **WHEN** synthesis receives queue message with additional fields `{ triggerSource, triggerId, triggerTimestamp }`
- **THEN** synthesis processes job normally and includes trigger metadata in completion callback

#### Scenario: Backward compatibility with manual triggers
- **WHEN** synthesis receives queue message without trigger metadata (manual trigger)
- **THEN** synthesis processes job with existing behavior and no trigger attribution

## MODIFIED Requirements

### Requirement: Synthesis worker has no database dependency
The synthesis service SHALL NOT connect to PostgreSQL. It SHALL derive all required paths from the queue message payload. TypeORM SHALL be removed from the synthesis service entirely. The service SHALL also handle trigger metadata from enhanced queue messages.

#### Scenario: Synthesis starts without DB env vars
- **WHEN** synthesis service starts with no `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` env vars
- **THEN** service starts successfully and processes jobs normally

#### Scenario: Synthesis resolves MinIO paths from queue message
- **WHEN** synthesis receives `{ orgSlug: "acme", projectSlug: "backend", repos: [{ slug: "api" }] }`
- **THEN** it reads context from MinIO at `acme/backend/api/context/` and writes synthesis to `acme/backend/synthesis/`

#### Scenario: Synthesis handles enhanced queue messages with trigger data
- **WHEN** synthesis receives enhanced message with `{ orgSlug, projectSlug, repos, triggerSource, triggerId }`
- **THEN** it processes synthesis normally and includes trigger metadata in completion callback