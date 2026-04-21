## Context

Synthesis currently runs as an async background task spawned inside the API process (`this.runSynthesis(...).catch(...)`). The job takes minutes, accesses storage, and calls the Anthropic API. This pattern breaks under Azure Functions (process reclaimed after response) and makes the API stateful.

## Goals / Non-Goals

**Goals:**
- Synthesis runs in a separate process/service
- API remains stateless (trigger only, no execution)
- Local dev: NATS JetStream queue, synthesis runs in docker-compose
- Production: Azure Service Bus queue, synthesis Container App with KEDA scale-to-zero
- Same DB and storage — synthesis service reads/writes directly (not via API)

**Non-Goals:**
- Per-repo synthesis (still per-project)
- Synthesis triggered on context push (still manual trigger via console/API)
- Job cancellation

## Decisions

### 1. QueueService abstraction

```typescript
interface QueueService {
  publish(queue: string, payload: Record<string, unknown>): Promise<void>;
  subscribe(queue: string, handler: (payload: Record<string, unknown>) => Promise<void>): Promise<void>;
}
```

Implementations:
- `NatsQueueService` — uses `nats` npm package with JetStream. Selected when `QUEUE_DRIVER=nats`.
- `ServiceBusQueueService` — uses `@azure/service-bus` SDK. Selected when `QUEUE_DRIVER=service-bus`.

Both registered as `QUEUE_SERVICE` token; selected by factory provider based on env var.

### 2. Message contract

Queue name: `synthesis-jobs`

```json
{ "projectId": "uuid" }
```

Synthesis service resolves everything else from the DB using `projectId`.

### 3. API changes

`SynthesisService.triggerForProject()`:
- Before: sets status to `running`, spawns background async task
- After: sets status to `running`, publishes `{ projectId }` to queue, returns

Status and files endpoints: unchanged — read directly from DB/storage.

`SynthesisModule` keeps `SynthesisController` and status/files logic. Removes execution logic (`runSynthesis`, Anthropic client, prompt file).

### 4. Synthesis service structure

```
applications/backend/synthesis/
  src/
    app.module.ts
    main.ts
    queue/
      queue.interface.ts
      nats-queue.service.ts
      service-bus-queue.service.ts
      queue.module.ts
    synthesis/
      synthesis.processor.ts   ← moved from API SynthesisService
      synthesis.module.ts
    minio/
      minio.service.ts          ← copied from API (reads/writes storage)
  package.json
  Dockerfile
  tsconfig.json
```

### 5. Local docker-compose additions

```yaml
nats:
  image: nats:2-alpine
  command: -js   # enable JetStream
  ports:
    - "4222:4222"

synthesis:
  build: synthesis
  environment:
    QUEUE_DRIVER: nats
    NATS_URL: nats://nats:4222
    DB_HOST: postgres
    MINIO_ENDPOINT: minio
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
  depends_on:
    - nats
    - postgres
    - minio
```

### 6. Production KEDA config (in `cloud-infra`)

```yaml
ScaledObject:
  minReplicaCount: 0
  maxReplicaCount: 5
  triggers:
    - type: azure-service-bus
      metadata:
        queueName: synthesis-jobs
        messageCount: "1"
```

## Risks / Trade-offs

- **Message loss on crash**: if synthesis service crashes after dequeuing but before completing, NATS JetStream re-delivers (ack timeout). Service Bus does the same. Must ensure idempotent status update (`running` → `done/error`) handles re-delivery.
- **DB access from synthesis**: synthesis service writes to the same DB as API. Acceptable — same PG instance, same credentials. Could proxy via API later if needed.
