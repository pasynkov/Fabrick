## ADDED Requirements

### Requirement: Postgres service in docker-compose
The docker-compose at `applications/backend/docker-compose.yml` SHALL include a Postgres 16 service. NestJS API SHALL depend on Postgres being healthy before starting.

#### Scenario: Full stack starts
- **WHEN** developer runs `docker-compose up` in `applications/backend/`
- **THEN** Postgres is available on port 5432, MinIO on 9000, NestJS on 3000

#### Scenario: Postgres health check
- **WHEN** docker-compose starts
- **THEN** NestJS waits for Postgres healthcheck (`pg_isready`) before starting

### Requirement: TypeORM connected to Postgres in NestJS
NestJS SHALL configure TypeORM via `TypeOrmModule.forRootAsync` using env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`. `synchronize: true` in development only.

#### Scenario: API starts with DB connected
- **WHEN** NestJS starts with valid DB env vars
- **THEN** TypeORM connects to Postgres and entities are synchronized

#### Scenario: API fails without DB
- **WHEN** Postgres is unreachable at startup
- **THEN** NestJS fails to start with a connection error

## MODIFIED Requirements

### Requirement: docker-compose brings up MinIO and NestJS
The infrastructure SHALL run with a single `docker-compose up` command. Postgres SHALL be included as a required service.

#### Scenario: Services start successfully
- **WHEN** developer runs `docker-compose up` in `applications/backend/`
- **THEN** Postgres is available on port 5432, MinIO is available on port 9000, and NestJS is available on port 3000

#### Scenario: Console is reachable
- **WHEN** docker-compose is running
- **THEN** MinIO console is accessible at http://localhost:9001 with default credentials
