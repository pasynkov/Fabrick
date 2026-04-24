## ADDED Requirements

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