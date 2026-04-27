## ADDED Requirements

### Requirement: MCP tests run on Node.js 24 runtime
All MCP tests SHALL execute on Node.js 24 runtime environment to ensure compatibility with the target runtime environment used in production.

#### Scenario: Unit tests execute on Node.js 24
- **WHEN** `npm test` is executed in Node.js 24 environment
- **THEN** all MCP unit tests pass without runtime version compatibility issues

#### Scenario: MCP server tools work correctly on Node.js 24
- **WHEN** MCP tool handler tests run on Node.js 24
- **THEN** all existing mock patterns and HTTP client behavior work without modification

#### Scenario: CI pipeline runs MCP tests on Node.js 24
- **WHEN** GitHub Actions ci-unit.yml workflow executes
- **THEN** test-mcp job uses `actions/setup-node@v4` with `node-version: '24'` and all tests pass