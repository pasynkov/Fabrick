## Context

The Fabrick project is a multi-application monorepo with 7 Node.js applications (API, CLI, MCP, Console, Landing, Loop, Synthesis) currently running on Node.js 20. The applications use various deployment targets including local development, Docker containers, and Azure Functions. The CI/CD pipeline uses GitHub Actions for testing and deployment automation.

Current Node.js 20 usage locations:
- Package.json `@types/node` dependencies across all applications
- GitHub Actions workflows using `actions/setup-node@v4` with `node-version: '20'`
- Docker images using `node:20-alpine` base images
- Azure Functions runtime expecting Node.js 20

## Goals / Non-Goals

**Goals:**
- Upgrade all applications to use Node.js 24 LTS consistently
- Maintain backward compatibility for existing functionality
- Ensure all tests pass with Node.js 24
- Update deployment infrastructure to use Node.js 24
- Verify all dependencies are compatible with Node.js 24

**Non-Goals:**
- Refactoring application code to use new Node.js 24 features
- Performance optimization beyond what Node.js 24 provides automatically
- Breaking API changes or feature modifications
- Upgrading major versions of other dependencies unless required for Node.js 24 compatibility

## Decisions

### Decision 1: Gradual vs All-at-Once Migration
**Choice:** All-at-once migration across all applications
**Rationale:** The applications share common dependencies and CI/CD pipelines. A gradual migration would create complexity in maintaining multiple Node.js versions simultaneously and could introduce inconsistencies. Since this is a LTS-to-LTS upgrade with high compatibility, the risk is manageable.
**Alternative Considered:** Gradual per-application migration was rejected due to shared infrastructure complexity.

### Decision 2: Docker Image Strategy
**Choice:** Update base images from `node:20-alpine` to `node:24-alpine`
**Rationale:** Alpine images provide smaller attack surface and size. Node.js 24 Alpine images are mature and well-tested. Maintaining Alpine consistency across the project.
**Alternative Considered:** Using `node:24-slim` was rejected to maintain current Alpine-based approach.

### Decision 3: CI/CD Migration Approach
**Choice:** Update all GitHub Actions workflows simultaneously
**Rationale:** All workflows share the same test matrix and deployment patterns. Updating simultaneously ensures consistency and avoids version mismatches between different test stages.
**Alternative Considered:** Phased workflow updates were rejected due to potential for inconsistent test environments.

### Decision 4: Azure Functions Runtime
**Choice:** Verify Azure Functions support for Node.js 24 and update configuration
**Rationale:** Azure Functions must support the runtime version for successful deployment. Node.js 24 is supported in Azure Functions as of early 2024.
**Alternative Considered:** Maintaining Node.js 20 for Azure Functions only was rejected to avoid version fragmentation.

### Decision 5: Development Environment Requirements
**Choice:** Require developers to upgrade to Node.js 24 locally
**Rationale:** Consistent development environment with production/CI reduces environment-specific bugs. Node.js 24 is LTS and widely available.
**Alternative Considered:** Supporting multiple local versions was rejected due to maintenance overhead.

## Risks / Trade-offs

**Risk: Dependency Incompatibility** → Mitigation: Test all applications thoroughly and check npm audit for compatibility warnings. Have rollback plan ready.

**Risk: Azure Functions Runtime Issues** → Mitigation: Test Azure Functions deployment in staging environment before production rollout. Verify all existing Functions continue to work.

**Risk: Developer Environment Disruption** → Mitigation: Provide clear upgrade instructions and timeline. Test applications work on Node.js 24 before requiring upgrade.

**Risk: Breaking Changes in Node.js 24** → Mitigation: Review Node.js 24 breaking changes documentation and test all existing functionality. Node.js 24 is LTS with minimal breaking changes from 20.

**Risk: CI/CD Pipeline Failure** → Mitigation: Update workflows in feature branch and test thoroughly before merging. Have ability to quickly revert to Node.js 20 if issues arise.

**Trade-off: Immediate Upgrade vs Gradual** → Accepting short-term coordination overhead for long-term consistency and reduced maintenance burden.