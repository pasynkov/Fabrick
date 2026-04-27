## ADDED Requirements

### Requirement: All applications run on Node.js 24 LTS
All Node.js applications in the project SHALL use Node.js version 24 LTS as their runtime environment for consistent performance, security, and feature availability.

#### Scenario: Package.json specifies Node.js 24 types
- **WHEN** any application's package.json is examined
- **THEN** `@types/node` dependency version is compatible with Node.js 24 (^24.0.0 or higher)

#### Scenario: Local development uses Node.js 24
- **WHEN** a developer runs `node --version` in their development environment
- **THEN** the version reported is Node.js 24.x.x

### Requirement: Docker containers use Node.js 24 base images
All Docker containers SHALL use Node.js 24 Alpine Linux base images to ensure consistent runtime environments in containerized deployments.

#### Scenario: API Dockerfile uses Node.js 24
- **WHEN** applications/backend/api/Dockerfile is examined
- **THEN** both builder and runtime stages use `node:24-alpine` as base image

#### Scenario: Synthesis Dockerfile uses Node.js 24
- **WHEN** applications/backend/synthesis/Dockerfile is examined  
- **THEN** both builder and runtime stages use `node:24-alpine` as base image

### Requirement: CI/CD pipelines use Node.js 24
All GitHub Actions workflows SHALL specify Node.js version 24 for consistent testing and deployment environments.

#### Scenario: Unit test workflow uses Node.js 24
- **WHEN** .github/workflows/ci-unit.yml is examined
- **THEN** all `actions/setup-node@v4` steps specify `node-version: '24'`

#### Scenario: E2E test workflow uses Node.js 24
- **WHEN** .github/workflows/ci-e2e.yml is examined
- **THEN** all `actions/setup-node@v4` steps specify `node-version: '24'`

#### Scenario: NPM publish workflow uses Node.js 24
- **WHEN** .github/workflows/cd-npm-publish.yml is examined
- **THEN** all `actions/setup-node@v4` steps specify `node-version: '24'`

### Requirement: Azure Functions runtime supports Node.js 24
Azure Functions deployment SHALL be configured to use Node.js 24 runtime for API services deployed to Azure Functions.

#### Scenario: Azure Functions configuration specifies Node.js 24
- **WHEN** Azure Functions configuration is examined
- **THEN** runtime version is set to Node.js 24 or compatible