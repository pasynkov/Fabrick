## ADDED Requirements

### Requirement: CLI tests run on Node.js 24 runtime
All CLI tests SHALL execute on Node.js 24 runtime environment to ensure compatibility with the target runtime environment used in production.

#### Scenario: Unit tests execute on Node.js 24
- **WHEN** `npm test` is executed in Node.js 24 environment
- **THEN** all CLI unit tests pass without runtime version compatibility issues

#### Scenario: Jest mocks work correctly on Node.js 24
- **WHEN** CLI command tests run with global fetch mocked
- **THEN** all mock patterns from existing test files work without modification on Node.js 24

#### Scenario: CI pipeline runs CLI tests on Node.js 24
- **WHEN** GitHub Actions ci-unit.yml workflow executes  
- **THEN** test-cli job uses `actions/setup-node@v4` with `node-version: '24'` and all tests pass