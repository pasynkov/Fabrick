## ADDED Requirements

### Requirement: Azure Functions runtime uses Node.js 24
The Azure Functions deployment SHALL use Node.js 24 runtime environment to ensure consistency with local development and CI/CD environments.

#### Scenario: Azure Functions Node.js version configured
- **WHEN** Azure Functions app configuration is examined
- **THEN** the WEBSITE_NODE_DEFAULT_VERSION is set to support Node.js 24 (e.g., "~24" or "24.x")

#### Scenario: func start uses Node.js 24 locally
- **WHEN** `func start` is run in `applications/backend/api/` with Node.js 24 installed
- **THEN** the Azure Functions runtime starts successfully and all routes are reachable via the Functions HTTP trigger