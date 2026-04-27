## 1. Package.json Updates

- [x] 1.1 Update @types/node to ^24.0.0 in applications/backend/api/package.json
- [x] 1.2 Update @types/node to ^24.0.0 in applications/backend/synthesis/package.json  
- [x] 1.3 Update @types/node to ^24.0.0 in applications/cli/package.json
- [x] 1.4 Update @types/node to ^24.0.0 in applications/console/package.json
- [x] 1.5 Update @types/node to ^24.0.0 in applications/landing/package.json
- [x] 1.6 Update @types/node to ^24.0.0 in applications/loop/package.json
- [x] 1.7 Update @types/node to ^24.0.0 in applications/mcp/package.json

## 2. Docker Image Updates

- [x] 2.1 Update applications/backend/api/Dockerfile builder stage FROM node:20-alpine to node:24-alpine
- [x] 2.2 Update applications/backend/api/Dockerfile runtime stage FROM node:20-alpine to node:24-alpine
- [x] 2.3 Update applications/backend/synthesis/Dockerfile builder stage FROM node:20-alpine to node:24-alpine
- [x] 2.4 Update applications/backend/synthesis/Dockerfile runtime stage FROM node:20-alpine to node:24-alpine

## 3. GitHub Actions Workflows

- [x] 3.1 Update .github/workflows/ci-unit.yml test-api job node-version from '20' to '24'
- [x] 3.2 Update .github/workflows/ci-unit.yml test-cli job node-version from '20' to '24'
- [x] 3.3 Update .github/workflows/ci-unit.yml test-mcp job node-version from '20' to '24'
- [x] 3.4 Update .github/workflows/ci-e2e.yml node-version from '20' to '24' (if exists)
- [x] 3.5 Update .github/workflows/cd-npm-publish.yml node-version from '20' to '24' (if exists)
- [x] 3.6 Update any other workflow files that reference node-version '20'

## 4. Azure Functions Configuration

- [x] 4.1 Verify Azure Functions app settings support Node.js 24 runtime
- [x] 4.2 Update Azure Functions deployment configuration for Node.js 24
- [x] 4.3 Test local Azure Functions with `func start` using Node.js 24

## 5. Dependency Compatibility Testing

- [x] 5.1 Run npm audit in all application directories to check Node.js 24 compatibility
- [x] 5.2 Update any dependencies that are incompatible with Node.js 24
- [x] 5.3 Test all applications build successfully with Node.js 24
- [x] 5.4 Verify TypeScript compilation works with Node.js 24 types

## 6. Testing and Validation

- [x] 6.1 Run API unit tests with Node.js 24 and verify all pass
- [x] 6.2 Run API e2e tests with Node.js 24 and verify all pass  
- [x] 6.3 Run CLI unit tests with Node.js 24 and verify all pass
- [x] 6.4 Run MCP unit tests with Node.js 24 and verify all pass
- [x] 6.5 Test local development setup with Node.js 24
- [x] 6.6 Test Docker container builds with Node.js 24 images

## 7. Documentation and Configuration

- [x] 7.1 Add .nvmrc file with Node.js 24 version if not present
- [x] 7.2 Update README or development setup docs to specify Node.js 24 requirement
- [x] 7.3 Update any deployment documentation referencing Node.js version
- [x] 7.4 Verify all configuration files reference correct Node.js version
