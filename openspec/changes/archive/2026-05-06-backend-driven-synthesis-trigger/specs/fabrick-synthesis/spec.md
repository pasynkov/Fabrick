## MODIFIED Requirements

### Requirement: Synthesis worker has no database dependency
The synthesis service SHALL NOT connect to PostgreSQL. It SHALL derive all required paths from the queue message payload. TypeORM SHALL be removed from the synthesis service entirely.

#### Scenario: Synthesis starts without DB env vars
- **WHEN** synthesis service starts with no `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` env vars
- **THEN** service starts successfully and processes jobs normally

#### Scenario: Synthesis resolves MinIO paths from queue message
- **WHEN** synthesis receives `{ orgSlug: "acme", projectSlug: "backend", repos: [{ slug: "api" }] }`
- **THEN** it reads context from MinIO at `acme/backend/api/context/` and writes synthesis to `acme/backend/synthesis/`
