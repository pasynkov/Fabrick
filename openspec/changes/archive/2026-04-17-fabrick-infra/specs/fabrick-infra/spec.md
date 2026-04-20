## ADDED Requirements

### Requirement: docker-compose brings up MinIO and NestJS
The infrastructure SHALL run with a single `docker-compose up` command.

#### Scenario: Services start successfully
- **WHEN** developer runs `docker-compose up` in `applications/backend/`
- **THEN** MinIO is available on port 9000 and NestJS is available on port 3000

### Requirement: MinIO console is accessible
MinIO SHALL expose a web console for local debugging.

#### Scenario: Console is reachable
- **WHEN** docker-compose is running
- **THEN** MinIO console is accessible at http://localhost:9001 with default credentials

### Requirement: NestJS health check
The NestJS skeleton SHALL respond to a health check endpoint.

#### Scenario: Health endpoint returns 200
- **WHEN** `GET /health` is called on port 3000
- **THEN** response is 200 OK

### Requirement: MinIO bucket auto-created
The `fabrick` bucket SHALL be created automatically on NestJS startup.

#### Scenario: Bucket exists after startup
- **WHEN** NestJS starts for the first time
- **THEN** `fabrick` bucket exists in MinIO without manual intervention
