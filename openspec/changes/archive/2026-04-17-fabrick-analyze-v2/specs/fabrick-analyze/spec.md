## MODIFIED Requirements

### Requirement: Env vars extracted with rich metadata
The skill SHALL extract env vars with name, type, description, and safe_to_share flag — not names only.

#### Scenario: Secret env var marked not shareable
- **WHEN** skill finds `JWT_SECRET` or `*_KEY` or `*_SECRET` pattern
- **THEN** `envs.yaml` entry has `safe_to_share: false`

#### Scenario: Enum env var extracted with values
- **WHEN** code contains conditional checks on env var value (e.g. `LOG_LEVEL === 'debug'`)
- **THEN** `envs.yaml` entry has `type: enum` and `values: [...]`

#### Scenario: URL env var typed correctly
- **WHEN** env var name ends in `_URL`, `_ENDPOINT`, `_HOST`
- **THEN** `envs.yaml` entry has `type: url` and `safe_to_share: true`

---

### Requirement: Endpoints extracted with schema
The skill SHALL extract endpoints with description, request shape, and response shape.

#### Scenario: Endpoint has request body schema
- **WHEN** controller method has typed request body (DTO, Pydantic model, struct)
- **THEN** `endpoints.yaml` entry has `request.body` with field names and types

#### Scenario: Endpoint has response schema
- **WHEN** controller method has typed return type
- **THEN** `endpoints.yaml` entry has `response.body` with field names and types

#### Scenario: Endpoint has human-readable description
- **WHEN** skill generates endpoint entries
- **THEN** each entry has `description` field summarizing what the endpoint does

---

### Requirement: Non-HTTP integrations extracted
The skill SHALL detect and extract Kafka, NATS, gRPC, WebSocket, and other non-HTTP communication patterns.

#### Scenario: Kafka consumer detected
- **WHEN** code contains `@KafkaListener`, `consumer.subscribe`, or equivalent
- **THEN** `integrations.yaml` has entry with `type: kafka`, `topic`, `direction: consumer`

#### Scenario: NATS publisher detected
- **WHEN** code contains `client.publish` or `@MessagePattern` with NATS transport
- **THEN** `integrations.yaml` has entry with `type: nats`, `subject`, `direction: publisher`

#### Scenario: gRPC service detected
- **WHEN** `.proto` file or gRPC client/server code exists
- **THEN** `integrations.yaml` has entry with `type: grpc` and `service` name

#### Scenario: External services from dependencies inferred
- **WHEN** postgres/redis/mongo/elasticsearch client used in code
- **THEN** `integrations.yaml` has entry with `type: postgres|redis|...` and `role`

---

### Requirement: dependencies.yaml removed
The skill SHALL NOT produce `dependencies.yaml`.

#### Scenario: No dependencies file after analysis
- **WHEN** skill completes analysis
- **THEN** `.fabrick/context/dependencies.yaml` does not exist

---

### Requirement: Business domain extracted
The skill SHALL produce `domain.md` with entities, business rules, and key flows found in code.

#### Scenario: Entities extracted from code
- **WHEN** code contains data models, DTOs, or database schemas
- **THEN** `domain.md` lists key entities with one-line descriptions

#### Scenario: Business rules extracted from code
- **WHEN** code contains constants, config values, or validation constraints with business meaning
- **THEN** `domain.md` lists rules with source file reference (e.g. "JWT expires 1h — auth.service.ts:42")

#### Scenario: Key flows described
- **WHEN** skill completes Claude analysis phase
- **THEN** `domain.md` describes 2–5 primary business flows end-to-end

---

### Requirement: Polyglot framework detection
The skill SHALL detect frameworks beyond TypeScript/Node.js.

#### Scenario: Java Spring Boot detected
- **WHEN** `pom.xml` or `build.gradle` exists with spring-boot dependency
- **THEN** `meta.yaml` has `language: java`, `framework: spring-boot`

#### Scenario: Python FastAPI detected
- **WHEN** `requirements.txt` or `pyproject.toml` contains `fastapi`
- **THEN** `meta.yaml` has `language: python`, `framework: fastapi`

#### Scenario: .NET detected
- **WHEN** `*.csproj` file exists
- **THEN** `meta.yaml` has `language: dotnet`

#### Scenario: DevOps repo detected
- **WHEN** `*.tf`, `Chart.yaml`, `kustomization.yaml`, or `Application.yaml` exists without app code
- **THEN** `meta.yaml` has `type: infrastructure` and relevant `tooling: [terraform|helm|...]`

---

### Requirement: Monorepo detection and per-app output
The skill SHALL detect monorepos and produce per-app context under `apps/` subdirectory.

#### Scenario: Monorepo detected
- **WHEN** `nx.json`, `turbo.json`, `lerna.json`, `go.work` exists, or multiple app manifests found under `apps/` or `packages/`
- **THEN** `meta.yaml` has `monorepo: true` and `apps: [list of app names]`

#### Scenario: Per-app context written
- **WHEN** monorepo detected
- **THEN** each app has its own directory under `.fabrick/context/apps/<app-name>/` with full context files

#### Scenario: Cross-app communication extracted
- **WHEN** monorepo detected and inter-app calls or shared packages exist
- **THEN** `.fabrick/context/cross-app.yaml` lists communications and shared packages

#### Scenario: Single-app repos unaffected
- **WHEN** repo is not a monorepo
- **THEN** output structure remains flat `.fabrick/context/` (no `apps/` subdirectory)
