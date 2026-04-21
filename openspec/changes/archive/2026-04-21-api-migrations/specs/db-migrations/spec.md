## ADDED Requirements

### Requirement: Schema managed via explicit migrations
The API SHALL use TypeORM migrations for all schema changes. `synchronize` SHALL be `false`. `migrationsRun` SHALL be `true`. Migrations SHALL run automatically on startup before the app accepts requests.

#### Scenario: Fresh database deployment
- **WHEN** API starts against an empty database
- **THEN** all 5 tables are created (`users`, `organizations`, `org_members`, `projects`, `repositories`) and the app starts successfully

#### Scenario: Already-migrated database
- **WHEN** API starts against a database where migrations have already run
- **THEN** TypeORM detects no pending migrations and starts without schema changes

#### Scenario: Concurrent startup (multi-instance)
- **WHEN** multiple API instances start simultaneously against the same database
- **THEN** only one instance runs the migrations, others wait and start normally after migrations complete

### Requirement: Init migration covers full schema
The Init migration SHALL create all tables needed to run the API from scratch. No manual SQL steps SHALL be required for a fresh deployment.

#### Scenario: Init migration up
- **WHEN** `1700000000000-Init` migration runs on empty database
- **THEN** tables `users`, `organizations`, `org_members`, `projects`, `repositories` exist with correct columns and constraints

#### Scenario: Init migration down
- **WHEN** `1700000000000-Init` migration is reverted
- **THEN** all 5 tables are dropped
