## MODIFIED Requirements

### Requirement: Skill split into orchestrator + scanner + synthesis
The skill SHALL consist of four files: SKILL.md (orchestrator), scanner.md (Haiku), synthesis.md (Sonnet), patterns.md (pattern library).

#### Scenario: Scanner runs as Haiku sub-invocation
- **WHEN** skill is invoked
- **THEN** orchestrator writes scanner task to `.fabrick/tmp/scanner-task.md` and invokes `claude` CLI with `--model claude-haiku-4-5-20251001`

#### Scenario: Scanner output consumed by synthesis
- **WHEN** scanner completes
- **THEN** `.fabrick/tmp/raw-extraction.yaml` exists and orchestrator proceeds to synthesis phase

#### Scenario: Tmp files cleaned up
- **WHEN** full analysis completes successfully
- **THEN** `.fabrick/tmp/` is removed

---

### Requirement: Scanner performs semantic tracing, not pure grep
The scanner SHALL trace non-standard decorator and abstraction patterns up to depth 2.

#### Scenario: Custom NestJS decorator resolved
- **WHEN** scanner finds an unknown decorator on a controller method
- **THEN** scanner reads the decorator's definition file to determine if it wraps `@Get`/`@Post`/etc., and extracts method + path accordingly

#### Scenario: Unresolvable abstraction recorded as unresolved
- **WHEN** trace depth exceeds 2 levels or definition cannot be found
- **THEN** raw-extraction records the item with `status: unresolved` and `hint` describing what was found

---

### Requirement: patterns.md read by scanner before each run
The scanner SHALL read `patterns.md` at the start of every scan to apply known project-specific patterns.

#### Scenario: Known pattern applied
- **WHEN** patterns.md contains an entry for "React API client wrappers"
- **THEN** scanner looks for `src/api/*.ts` files and traces their methods before falling back to generic discovery

#### Scenario: Empty patterns.md does not block scanner
- **WHEN** patterns.md is empty or missing
- **THEN** scanner proceeds with standard discovery only

---

### Requirement: connection_points.yaml replaces endpoints.yaml and integrations.yaml
The skill SHALL produce `connection_points.yaml` with `inbound` and `outbound` sections.

#### Scenario: HTTP inbound endpoint captured
- **WHEN** service has HTTP route handlers
- **THEN** `connection_points.inbound` contains entries with `type: http`, method, path, schema, file

#### Scenario: Kafka consumer captured as inbound
- **WHEN** service consumes Kafka topics
- **THEN** `connection_points.inbound` contains entry with `type: kafka`, topic, direction: consumer, schema.message if discoverable

#### Scenario: Kafka publisher captured as outbound
- **WHEN** service publishes to Kafka topics
- **THEN** `connection_points.outbound` contains entry with `type: kafka`, topic, direction: publisher

#### Scenario: HTTP outgoing call captured
- **WHEN** service makes HTTP calls via axios/fetch/HttpService or abstraction thereof
- **THEN** `connection_points.outbound` contains entry with `type: http`, target_env (if URL from env var), method, path

#### Scenario: Unresolved outgoing call recorded
- **WHEN** HTTP abstraction cannot be traced within depth 2
- **THEN** entry recorded with `status: unresolved` and `hint` describing what was found

#### Scenario: No endpoints.yaml or integrations.yaml produced
- **WHEN** skill completes
- **THEN** neither `endpoints.yaml` nor `integrations.yaml` exists in output

---

### Requirement: Messaging schemas extracted
Kafka, NATS, gRPC message schemas SHALL be extracted alongside HTTP schemas.

#### Scenario: NATS contract file found and parsed
- **WHEN** NATS subject has a corresponding contract file (e.g. `contracts/reap.contract.ts`)
- **THEN** `schema.message` in connection_points is populated with field names and types

#### Scenario: Schema not found
- **WHEN** message schema cannot be determined
- **THEN** `schema` field omitted — not invented

---

### Requirement: Frontend outgoing calls captured
Frontend applications SHALL have outgoing HTTP calls captured in `connection_points.outbound`.

#### Scenario: Direct fetch/axios call captured
- **WHEN** frontend code contains `fetch(url)` or `axios.post(url)` with resolvable URL
- **THEN** `connection_points.outbound` entry created with method, resolved path, target_env if URL from env var

#### Scenario: No inbound entries for pure frontend
- **WHEN** app has no HTTP server (frontend only)
- **THEN** `connection_points.inbound` is empty list `[]`
