## Why

No way to test the full Fabrick flow (scan → push → synthesize → search) locally without running Postgres, Azure Blob, NATS, and auth infrastructure. Need a lightweight sandbox that reuses production code with filesystem-based storage, so we can validate the end-to-end pipeline with real services and zero infra.

## What Changes

- Extract shared NestJS library (`applications/backend/shared/`) with:
  - `WikiRepository` interface (repository pattern with DI)
  - `SynthesisImpl` — core synthesis logic (buildContext, synthesize, parseResponse)
  - `SearchImpl` — core search logic (slug selection + answer generation), injects WikiRepository
  - Synthesis system prompt as TS constant (replaces text asset file)
  - Shared types (WikiPageData, ExistingPage)
- Refactor `api/search.service.ts` to delegate to shared `SearchImpl`
- Refactor `synthesis/synthesis.processor.ts` to delegate to shared `SynthesisImpl`
- New NestJS app `applications/backend/sandbox/` that:
  - Implements `WikiRepository` with filesystem storage (MD files with frontmatter)
  - Exposes same HTTP API surface as production (no auth guards)
  - Runs synthesis synchronously (no queue)
  - On startup: configures target repo dirs with credentials/config, generates MCP token
- CLI and MCP reused as-is, pointed at sandbox via `FABRICK_API_URL=http://localhost:3001`

## Capabilities

### New Capabilities
- `shared-wiki-repository`: WikiRepository interface, shared types, and DI token for cross-app wiki page storage abstraction
- `shared-synthesis-impl`: Extracted synthesis core logic (buildContext, Claude call, response parsing) as injectable NestJS service
- `shared-search-impl`: Extracted search core logic (2-step Claude search) as injectable NestJS service that uses WikiRepository
- `local-sandbox-app`: NestJS sandbox application with filesystem WikiRepository, no-auth endpoints, synchronous synthesis, and startup repo configuration

### Modified Capabilities
- `fabrick-synthesis`: Processor delegates to shared SynthesisImpl instead of inline logic; prompt moves to shared TS constant
- `fabrick-search`: Search service delegates to shared SearchImpl instead of inline Claude calls

## Impact

- **Code**: `applications/backend/api/src/search/`, `applications/backend/synthesis/src/synthesis/`, new `applications/backend/shared/`, new `applications/backend/sandbox/`
- **Dependencies**: No new external dependencies. Shared library uses existing `@anthropic-ai/sdk`, `@nestjs/common`
- **APIs**: Sandbox exposes subset of production API (5 endpoints). Production API unchanged
- **Build**: NestJS monorepo library added to backend `nest-cli.json`/`tsconfig.json`
