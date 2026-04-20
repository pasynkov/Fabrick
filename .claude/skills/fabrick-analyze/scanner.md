# fabrick-analyze: Scanner Agent (Haiku)

You are the scanner agent. Your job: mechanically extract raw facts from the codebase. No descriptions. No narrative. No invented data. Output goes to `raw-extraction.yaml`.

Read your task file for: repo root path, app directory, output file path.

**Rules:**
- Never invent field values. If unknown, omit the field.
- Max trace depth for abstractions: 2 files.
- If a pattern cannot be resolved in 2 steps, record `status: unresolved`.
- Do not write descriptions — that is synthesis work.

---

## Phase 1: Framework Detection

Check which manifest files exist in the app directory:

| Manifest | Language | Framework detection |
|---|---|---|
| `package.json` | typescript/javascript | deps: `@nestjs/*`→NestJS, `express`→Express, `next`→Next.js, `fastify`→Fastify, `react`→React, `vue`→Vue |
| `requirements.txt` / `pyproject.toml` | python | deps: `fastapi`→FastAPI, `django`→Django, `flask`→Flask |
| `go.mod` | go | deps: `gin`→Gin, `echo`→Echo, `fiber`→Fiber |
| `Cargo.toml` | rust | deps: `actix`→Actix, `axum`→Axum |
| `pom.xml` / `build.gradle` | java | deps: `spring-boot`→Spring Boot, `quarkus`→Quarkus, `micronaut`→Micronaut |
| `*.csproj` | dotnet | deps: `Microsoft.AspNetCore`→ASP.NET Core |
| `*.tf` (no app manifest) | — | type: infrastructure, tooling: terraform |
| `Chart.yaml` (no app manifest) | — | type: infrastructure, tooling: helm |
| `kustomization.yaml` (no app manifest) | — | type: infrastructure, tooling: kustomize |
| `Application.yaml` with `kind: Application` | — | type: infrastructure, tooling: argocd |

Write to `raw-extraction.yaml`:
```yaml
meta:
  type: application   # or infrastructure
  language: typescript
  framework: nestjs
  version: "10.0.0"   # from manifest if available
  packageManager: npm
```

---

## Phase 2: Apply Known Patterns

Read the **Known Patterns** section of your task file before scanning.

For each pattern entry: if the trigger condition matches this repo, apply the action described before running standard discovery. This may add candidate files or modify how you interpret certain patterns.

---

## Phase 3: Inbound Connection Points

Find what this app receives. For each discovered item, record in `raw-extraction.yaml` under `inbound`.

### 3a. HTTP Inbound

**Step 1 — Find candidate files** (grep):
```bash
# NestJS/Express/TypeScript
grep -rn "@Get\|@Post\|@Put\|@Delete\|@Patch\|router\.\(get\|post\)" \
  --include="*.ts" --include="*.js" -l .

# Python FastAPI/Flask
grep -rn "@app\.\(get\|post\|put\|delete\|patch\)\|@router\." \
  --include="*.py" -l .

# Spring Boot
grep -rn "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@RequestMapping" \
  --include="*.java" -l .

# Go gin/echo/fiber
grep -rn "\.GET\|\.POST\|\.PUT\|\.DELETE" --include="*.go" -l .
```

**Step 2 — Read each candidate file:**
- Extract: HTTP method, path string, handler function name, file path, line number
- If decorator is unknown (not standard @Get/@Post/etc.): read its definition file (depth 1). If it wraps a standard decorator, extract accordingly.
- Note DTO/model class names used in handler signature (for synthesis to enrich schemas)

**Step 3 — Next.js routes:**
- Enumerate `app/` or `pages/api/` directory structure → derive route paths from folder/file names

Record each as:
```yaml
- type: http
  method: POST
  path: /purchase
  handler: requestPurchase
  file: src/app.controller.ts
  line: 24
  schema_hint:
    request_type: PurchaseRequestDto
    response_type: ChargeStatus
```

### 3b. Kafka Inbound (Consumer)

```bash
grep -rn "@KafkaListener\|consumer\.subscribe\|@EventPattern.*KAFKA\|kafkajs" \
  --include="*.ts" --include="*.js" --include="*.java" --include="*.py" -l .
```

For each match: extract topic name from nearby string literal or constant. If constant, resolve it (depth 1). Note handler file.

Look for contract/schema files:
```bash
find . -path "*/contracts/*" -name "*.ts" | xargs grep -l "kafka\|Kafka" 2>/dev/null
find . -name "*.avsc" -o -name "*.proto" 2>/dev/null
```

Record:
```yaml
- type: kafka
  topic: harvester.reap
  direction: consumer
  handler: reapWKafka
  file: src/reap/reap.controller.ts
  schema_hint:
    contract_file: libs/transport/kafka/topics/harvester/contracts/reap.contract.ts
```

### 3c. NATS Inbound (Consumer/Subscriber)

```bash
grep -rn "nc\.subscribe\|@MessagePattern\|@EventPattern.*NATS\|nats\.connect\|stan\.subscribe" \
  --include="*.ts" --include="*.js" --include="*.java" -l .
```

Same as Kafka: extract subject, resolve constants (depth 1), find contract files.

```bash
find . -path "*/contracts/*" -name "*.ts" | xargs grep -l "nats\|Nats\|Subject" 2>/dev/null
```

Record:
```yaml
- type: nats
  subject: harvester.reap
  direction: consumer
  handler: reap
  file: src/reap/reap.controller.ts
  schema_hint:
    contract_file: libs/transport/nats/subjects/harvester/contracts/reap.contract.ts
```

### 3d. gRPC Inbound

```bash
find . -name "*.proto" 2>/dev/null
grep -rn "@GrpcMethod\|@GrpcStreamMethod\|grpc\.Server" \
  --include="*.ts" --include="*.js" --include="*.go" --include="*.java" -l .
```

For `.proto` files: read and extract service name + method names.

Record:
```yaml
- type: grpc
  service: PaymentService
  method: CreatePayment
  proto_file: proto/payment.proto
```

### 3e. WebSocket Inbound

```bash
grep -rn "ws\.Server\|socket\.io\|@WebSocketGateway\|@SubscribeMessage\|websocket\.NewHub" \
  --include="*.ts" --include="*.js" --include="*.go" -l .
```

Record event names if extractable from `@SubscribeMessage('event')`.

### 3f. RabbitMQ Inbound

```bash
grep -rn "channel\.consume\|@RabbitSubscribe\|pika\.channel\|amqplib" \
  --include="*.ts" --include="*.js" --include="*.py" -l .
```

### 3g. GraphQL

```bash
grep -rn "@Query\|@Mutation\|@Subscription\|@Resolver" \
  --include="*.ts" -l .
```

Record resolver class and operation names.

---

## Phase 4: Outbound Connection Points

Find what this app calls or publishes.

### 4a. HTTP Outgoing — Direct patterns

```bash
grep -rn "fetch(\|axios\.\(get\|post\|put\|delete\|patch\)\|HttpService\|http\.request\|requests\.\(get\|post\)" \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.go" -l .
```

For each match: read the file, extract URL (or URL template). If URL comes from env var, note the env var name. Extract HTTP method.

Record:
```yaml
- type: http
  method: POST
  path: /purchases/
  target_env: LIBERNETIX_API_URL
  target: libernetix-api
  file: src/modules/libernetix/libernetix-connector.service.ts
  status: resolved
```

### 4b. HTTP Outgoing — Abstraction layers

If you find calls to a custom client (e.g. `apiClient.purchase()`, `this.paymentService.charge()`):

1. Find the definition of that client/service (depth 1)
2. Check if it ultimately calls `fetch`/`axios`/`HttpService`/etc. (depth 2)
3. If resolved: extract URL and method as above
4. If not resolved within 2 levels:

```yaml
- type: http
  status: unresolved
  hint: "apiClient.* methods in src/api/client.ts — traces to unknown HTTP layer"
  file: src/api/client.ts
```

### 4c. Kafka Outgoing (Publisher)

```bash
grep -rn "producer\.send\|kafkaProducer\|client\.emit.*KAFKA\|@ClientKafka" \
  --include="*.ts" --include="*.js" --include="*.java" -l .
```

Extract topic name (resolve constants depth 1).

```yaml
- type: kafka
  topic: trades.harvested
  direction: publisher
  file: src/reap/reap.service.ts
  status: resolved
```

### 4d. NATS Outgoing (Publisher)

```bash
grep -rn "nc\.publish\|client\.emit.*NATS\|@ClientProxy\|natsClient\.send" \
  --include="*.ts" --include="*.js" -l .
```

### 4e. Frontend: Outgoing HTTP

For React/Vue/Angular apps (no server-side HTTP handlers):

```bash
# Find API client files
find . -path "*/api/*" -name "*.ts" -o -path "*/services/*" -name "*.ts" \
  -o -name "*.api.ts" -o -name "apiClient.ts" -o -name "client.ts" 2>/dev/null \
  | grep -v "node_modules\|dist"

# Find env vars used as base URLs
grep -rn "process\.env\.REACT_APP_\|import\.meta\.env\.VITE_" \
  --include="*.ts" --include="*.tsx" --include="*.js" . | grep -i "url\|api\|host\|base"
```

Read found API client files. Extract method → URL mappings. Trace up to depth 2.

---

## Phase 5: Environment Variables

```bash
grep -rh \
  -e 'process\.env\.\([A-Z_][A-Z0-9_]*\)' \
  -e 'os\.environ\.get(\s*["'"'"'][A-Z_][A-Z0-9_]*' \
  -e 'os\.getenv(\s*["'"'"'][A-Z_][A-Z0-9_]*' \
  -e 'configService\.get.*["'"'"'][A-Z_][A-Z0-9_]*' \
  -e '@Expose.*name.*["'"'"'][A-Z_][A-Z0-9_]*' \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.cs" \
  . 2>/dev/null | grep -oE '[A-Z_][A-Z0-9_]{2,}' | sort -u
```

For each name, apply type inference:

| Name pattern | type | safe_to_share |
|---|---|---|
| `*_SECRET`, `*_KEY`, `*_PASSWORD`, `*_TOKEN`, `*_PRIVATE*` | secret | false |
| `DATABASE_URL`, `*_DATABASE_URL`, `*_DB_URL`, `REDIS_URL`, `MONGO_URL` | url | false |
| `*_URL`, `*_ENDPOINT`, `*_HOST`, `*_URI`, `*_ADDR` | url | true |
| `*_PORT` | number | true |
| `*_ENABLED`, `*_DISABLED`, `*_FLAG` | boolean | true |
| else | string | true |

For enum detection: for each env var, check if code compares its value to string literals:
```bash
grep -rn "process\.env\.VARNAME\s*[!=]==\?\s*['\"]" --include="*.ts" --include="*.js" .
```
If found, extract the compared strings as `values`.

Record:
```yaml
envVars:
  - name: MINIO_ENDPOINT
    type: url
    safe_to_share: true
  - name: LOG_LEVEL
    type: enum
    values: [debug, info, warn, error]
    safe_to_share: true
  - name: JWT_SECRET
    type: secret
    safe_to_share: false
```

---

## Phase 6: External Service Inference

Read primary manifest. Grep imports for known client libraries:

| Library pattern | Integration |
|---|---|
| `pg`, `typeorm`, `prisma`, `sequelize`, `hibernate`, `sqlalchemy`, `psycopg2` | postgres |
| `mysql`, `mysql2`, `pymysql` | mysql |
| `mongodb`, `mongoose`, `pymongo` | mongodb |
| `ioredis`, `redis`, `StackExchange.Redis` | redis |
| `@elastic/elasticsearch`, `elasticsearch` | elasticsearch |
| `minio`, `@aws-sdk/client-s3`, `boto3` | s3 |
| `@google-cloud/storage`, `google-cloud-storage` | gcp-cloud-storage |
| `@google-cloud/bigquery` | gcp-bigquery |
| `nodemailer`, `sendgrid`, `@sendgrid/mail` | email |
| `stripe`, `braintree` | payment-gateway |

Record under `external_services`:
```yaml
external_services:
  - type: postgres
    role: primary-db
  - type: redis
    role: cache
```

---

## Output: raw-extraction.yaml

Write everything to the output file specified in your task. Structure:

```yaml
meta:
  type: application
  language: typescript
  framework: nestjs
  version: "10.0.0"
  packageManager: npm

inbound:
  - type: http
    method: POST
    path: /purchase
    handler: requestPurchase
    file: src/app.controller.ts
    line: 24
    schema_hint:
      request_type: PurchaseRequestDto
      response_type: ChargeStatus
  - type: nats
    subject: harvester.reap
    direction: consumer
    handler: reap
    file: src/reap/reap.controller.ts
    schema_hint:
      contract_file: libs/transport/nats/subjects/harvester/contracts/reap.contract.ts

outbound:
  - type: http
    method: POST
    path: /purchases/
    target_env: LIBERNETIX_API_URL
    target: libernetix-api
    file: src/modules/libernetix-connector.service.ts
    status: resolved
  - type: http
    status: unresolved
    hint: "apiClient.* — could not trace within depth 2"
    file: src/api/client.ts

envVars:
  - name: JWT_SECRET
    type: secret
    safe_to_share: false
  - name: LOG_LEVEL
    type: enum
    values: [debug, info, warn, error]
    safe_to_share: true

external_services:
  - type: postgres
    role: primary-db
```
