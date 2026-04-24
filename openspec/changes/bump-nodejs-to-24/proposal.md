## Why

The project currently uses Node.js 20, but Node.js 24 is now the latest LTS (Long Term Support) version offering improved performance, security updates, and new language features. Upgrading ensures the project benefits from the latest stable Node.js capabilities and maintains support for future dependencies that may require Node.js 24+.

## What Changes

- Update all package.json files to specify Node.js 24 in `@types/node` dependencies
- Update GitHub Actions CI/CD workflows to use Node.js 24 instead of 20
- Update Docker base images from `node:20-alpine` to `node:24-alpine`
- Update any Node.js version references in documentation or configuration files
- Verify compatibility of all existing dependencies with Node.js 24

## Capabilities

### New Capabilities
- `nodejs-24-runtime`: Runtime environment using Node.js 24 LTS across all applications and infrastructure

### Modified Capabilities
- `api-azure-functions`: Azure Functions deployment needs Node.js 24 runtime configuration
- `cli-testing`: CLI testing workflows require Node.js 24 for test execution
- `api-testing`: API testing workflows require Node.js 24 for test execution
- `mcp-testing`: MCP testing workflows require Node.js 24 for test execution

## Impact

**Affected Systems:**
- All Node.js applications: API, CLI, MCP, Console, Landing, Loop, Synthesis
- GitHub Actions CI/CD workflows for testing and deployment
- Docker containers for backend services
- Development environment setup

**Dependencies:**
- All npm packages must be compatible with Node.js 24
- Azure Functions runtime must support Node.js 24
- Development tooling (TypeScript, Jest, etc.) compatibility verification

**Breaking Changes:**
- Development environments will need to upgrade to Node.js 24
- Docker images will use new base image requiring rebuild
- CI/CD pipelines will use new Node.js version