### Requirement: Unit tests cover all API services
The API SHALL have unit tests for all service classes. Tests MUST run without any external infrastructure (no database, no storage, no queue). All dependencies SHALL be mocked via jest.mock or NestJS testing utilities.

#### Scenario: Auth service unit test
- **WHEN** AuthService.register() is called with valid credentials
- **THEN** it creates a hashed password, persists the user via repository mock, and returns a JWT token

#### Scenario: Orgs service unit test
- **WHEN** OrgsService.create() is called with org name and owner user
- **THEN** it calls repository.save() with correct entity and returns the created org

#### Scenario: Repos service unit test
- **WHEN** ReposService.create() is called for an org the user belongs to
- **THEN** it persists the repo and returns it; if org not found, it throws NotFoundException

#### Scenario: Context upload service unit test
- **WHEN** ContextService.upload() is called with file content
- **THEN** it calls StorageService.putObject() with correct key and returns the blob reference without hitting real storage

#### Scenario: Synthesis trigger service unit test
- **WHEN** SynthesisService.trigger() is called with a valid repo context
- **THEN** it calls QueueService.publish() with correct job payload without hitting real Service Bus

### Requirement: Unit tests cover all API controllers
The API SHALL have unit tests for all controller classes. Controllers MUST be tested in isolation with service layer mocked. Tests SHALL verify request mapping, DTO validation, and response shape.

#### Scenario: Auth controller registration endpoint
- **WHEN** POST /auth/register is called with valid body
- **THEN** controller delegates to AuthService.register() and returns 201 with token

#### Scenario: Controller returns correct HTTP status on service error
- **WHEN** a service throws a NestJS HttpException
- **THEN** controller propagates it and the response has the correct status code

### Requirement: E2e tests cover API contracts with real PostgreSQL
The API SHALL have e2e tests that run against a real PostgreSQL database with TypeORM migrations applied. External services (Blob Storage, Service Bus) SHALL be mocked via overrideProvider. Tests MUST use supertest to send HTTP requests to the actual NestJS application.

#### Scenario: User registration and login flow
- **WHEN** POST /auth/register is called, then POST /auth/login with same credentials
- **THEN** both return 201/200 respectively with a valid JWT token

#### Scenario: Org creation requires authentication
- **WHEN** POST /orgs is called without Authorization header
- **THEN** response is 401 Unauthorized

#### Scenario: Repo context upload stores metadata in database
- **WHEN** POST /repos/:id/context is called with file payload
- **THEN** response is 201, metadata is persisted in DB, StorageService.putObject mock is called once

#### Scenario: Synthesis trigger publishes to queue
- **WHEN** POST /repos/:id/synthesize is called
- **THEN** response is 202, QueueService.publish mock is called with correct job payload

### Requirement: E2e test database setup runs migrations automatically
The e2e test suite SHALL create a dedicated `fabrick_test` database and run all TypeORM migrations before any test executes. Teardown SHALL drop the database or truncate all tables after each test suite.

#### Scenario: globalSetup creates test database
- **WHEN** jest e2e suite starts
- **THEN** `fabrick_test` database exists and all migration tables are present before first test runs

#### Scenario: Each test suite cleans up its data
- **WHEN** an e2e test file's afterEach/afterAll runs
- **THEN** rows created during that test are removed so next test starts with clean state

### Requirement: Separate jest configurations for unit and e2e
The API SHALL have two jest configuration files: one for unit tests and one for e2e tests. The unit config MUST NOT require any running infrastructure. The e2e config SHALL include globalSetup for database initialization.

#### Scenario: Unit tests run without database
- **WHEN** `npm run test:unit` is executed
- **THEN** all unit tests pass without a running PostgreSQL instance

#### Scenario: E2e tests run with database sidecar
- **WHEN** `npm run test:e2e` is executed with DB_HOST set
- **THEN** globalSetup connects, runs migrations, tests execute, teardown completes

### Requirement: Tests run on Node.js 24 runtime
All API tests SHALL execute on Node.js 24 runtime environment to ensure compatibility and consistency with production deployments.

#### Scenario: Jest unit tests execute on Node.js 24
- **WHEN** `npm run test:unit` is executed in Node.js 24 environment
- **THEN** all unit tests pass without runtime version compatibility issues

#### Scenario: Jest e2e tests execute on Node.js 24  
- **WHEN** `npm run test:e2e` is executed in Node.js 24 environment
- **THEN** all e2e tests pass with database connectivity and TypeORM migrations working correctly

#### Scenario: CI pipeline runs tests on Node.js 24
- **WHEN** GitHub Actions ci-unit.yml workflow executes
- **THEN** test-api job uses `actions/setup-node@v4` with `node-version: '24'` and all tests pass
