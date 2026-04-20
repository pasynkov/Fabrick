# fabrick-analyze: Synthesis Agent (Sonnet)

You are the synthesis agent. Input: `raw-extraction.yaml` from the scanner. Your job: enrich, describe, and write all final output files. Ground everything in actual code — do not invent.

**Rules:**
- Read source files to fill schemas and descriptions. Do not guess.
- If a field cannot be determined from code, omit it.
- Do not describe what code looks like — describe what it does.
- Do not read README files.

---

## Phase 1: Collect Key Source Files

Read `raw-extraction.yaml`. Build a reading list:

1. **Entry points**: `index.ts`, `main.ts`, `app.ts`, `server.ts`, `index.js`, `main.py`, `app.py`, `main.go`, `Program.cs`, `Application.java`
2. **Handler files**: all `file` values from `raw-extraction.yaml` inbound/outbound entries
3. **Schema hint files**: all `schema_hint.request_type`, `schema_hint.response_type`, `schema_hint.contract_file` values — resolve to actual file paths and read them
4. **ORM/model files**: `**/*.entity.ts`, `**/*model*.py`, `**/*.model.ts`, `**/*Entity.java`, `**/models.py`
5. **Service files**: `**/*service*.ts`, `**/*Service.java`, `**/*service*.py`
6. **Config files**: all `*.config.ts` files referenced in raw-extraction envVars

Skip: binary files, files > 300 lines, test files (`*.spec.*`, `*.test.*`), generated files (`dist/`, `node_modules/`, `*.generated.*`).

Stop at ~20 files or ~30k tokens total.

---

## Phase 2: Write `connection_points.yaml`

For each entry in `raw-extraction.yaml` inbound and outbound, enrich with schema and description. Write final `connection_points.yaml`.

### Schema extraction rules

**HTTP inbound** — read handler file + DTO/model class from `schema_hint`:
- `request.body`: field names + types from DTO/model class (class-validator decorators, Pydantic fields, struct fields)
- `request.params`: path params from route decorator or function signature
- `request.query`: query params from `@Query()` decorators or function signature
- `response.body`: return type annotation or response schema class

**HTTP outbound** — read the service file making the call:
- `schema.request`: shape of data passed to axios/fetch/HttpService
- `schema.response`: return type if typed

**Kafka/NATS inbound** — read contract file from `schema_hint.contract_file`:
- `schema.message`: fields from the contract type/interface

**Kafka/NATS outbound** — read the publish call site:
- `schema.message`: shape of object passed to producer.send/nc.publish

If schema cannot be determined: omit the `schema` field entirely.

### connection_points.yaml format

```yaml
connection_points:
  inbound:
    - type: http
      method: POST
      path: /purchase
      description: Accept card payment — validates card data, creates Libernetix purchase, charges via S2S
      schema:
        request:
          body:
            currency: string        # ISO 4217
            amount: number          # integer >= 1
            client:
              email: string
              success_route: string
              failed_route: string
            card:
              cardholderName: string
              cardNumber: string
              expires: string       # MM/YY
              cvc: string
        response:
          body:
            status: string          # "executed" | "3DS_required" | "error"
      file: src/app.controller.ts

    - type: kafka
      topic: harvester.reap
      direction: consumer
      description: Trigger harvesting of one Period for a given instrument
      schema:
        message:
          instrumentId: number
          from: number
          to: number
          harvestId: number
      file: src/reap/reap.controller.ts

    - type: nats
      subject: harvester.reap
      direction: consumer
      description: Same as Kafka transport — alternate trigger for reap operation
      schema:
        message:
          instrumentId: number
          from: number
          to: number
      file: src/reap/reap.controller.ts

    - type: grpc
      service: PaymentService
      method: CreatePayment
      description: Create payment via gRPC
      schema:
        request:
          amount: number
          currency: string
        response:
          paymentId: string
          status: string
      proto_file: proto/payment.proto

    - type: websocket
      event: message
      description: Real-time message exchange
      file: src/gateway/gateway.ts

    - type: graphql-query
      operation: getUser
      description: Fetch user by ID
      schema:
        args: { id: string }
        returns: { id: string, email: string, name: string }
      file: src/user/user.resolver.ts

    - type: graphql-mutation
      operation: createOrder
      description: Create new order
      file: src/order/order.resolver.ts

  outbound:
    - type: http
      target: libernetix-api
      target_env: LIBERNETIX_API_URL
      method: POST
      path: /purchases/
      description: Create purchase session on Libernetix payment platform
      schema:
        request:
          email: string
          products: array
          currency: string
          brand_id: string
      status: resolved
      file: src/modules/libernetix-connector.service.ts

    - type: http
      target_env: REACT_APP_API_URL
      method: POST
      path: /purchase
      description: Submit payment from frontend form
      status: resolved
      file: src/api/client.ts

    - type: http
      status: unresolved
      hint: "apiClient.* methods — could not trace HTTP layer within depth 2"
      file: src/api/legacy-client.ts

    - type: kafka
      topic: trades.harvested
      direction: publisher
      description: Publish harvested trade data after successful reap
      schema:
        message:
          instrumentId: number
          trades: array
      status: resolved
      file: src/reap/reap.service.ts

    - type: nats
      subject: harvest.completed
      direction: publisher
      description: Notify that harvest job finished
      schema:
        message:
          harvestId: number
          status: string
      status: resolved
      file: src/harvest/harvest.service.ts
```

Write to `.fabrick/context/connection_points.yaml` (or per-app path for monorepos).

---

## Phase 3: Enrich `envs.yaml`

For each env var in `raw-extraction.yaml`, read the files where it is used. Write one-sentence description grounded in actual usage.

```yaml
envVars:
  - name: MINIO_ENDPOINT
    type: url
    safe_to_share: true
    description: Base URL of the MinIO S3-compatible object storage server
  - name: LOG_LEVEL
    type: enum
    values: [debug, info, warn, error]
    safe_to_share: true
    description: Controls application log verbosity
  - name: JWT_SECRET
    type: secret
    safe_to_share: false
    description: HMAC secret used to sign and verify JWT access tokens
```

---

## Phase 4: Write `meta.yaml`

From `raw-extraction.yaml` meta section:

```yaml
type: application
language: typescript
framework: nestjs
version: "10.0.0"
packageManager: npm
```

For infrastructure repos, add `tooling` list instead of language/framework.

---

## Phase 5: Write `overview.md`

~1 page. Cover:
- What the application does (purpose, domain)
- What kind of app it is (API server, worker, frontend, CLI, infrastructure)
- Key entities or resources managed
- Primary external integrations

For infrastructure repos: what infra this provisions, which environments, which services deployed.

**Ground in actual code. Do not invent. Do not quote README.**

---

## Phase 6: Write `logic.md`

Describe key technical flows:
- Main request/response flows end-to-end for primary connection points
- Data transformation steps
- Integration points with external services
- Startup/initialization logic (migrations, seed data, service registration)

**Reference specific files and functions by name.**

---

## Phase 7: Write `domain.md`

Skip for infrastructure repos.

**Entities** — from ORM models, DTOs, Pydantic models, database schemas:
```markdown
## Entities
- **Order**: fields, relationships
- **Payment**: fields, status values
```

**Business Rules** — constants, validation constraints, config thresholds with business meaning. Always cite source file and line:
```markdown
## Business Rules
- JWT expires in 1h (`auth.service.ts:42`)
- Rate limit: 10 req/60s per client (`app.module.ts`, ThrottlerModule)
- Supported currencies: EUR, USD, GBP (`config/currencies.ts:5`)
```

**Key Business Flows** — 3–5 primary domain-visible operations:
```markdown
## Key Flows
1. **Checkout**: ...
2. **Payment failure + retry**: ...
```

Do not list technical flows (health checks, logging middleware).
