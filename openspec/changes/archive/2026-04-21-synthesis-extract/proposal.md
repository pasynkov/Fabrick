## Why

Synthesis runs as a long-running async background task inside the API process. This blocks Azure Functions deployment (no persistent background tasks) and makes the API stateful. Synthesis jobs can take several minutes and need to survive independently of the API process lifecycle.

Extracting synthesis into a dedicated service enables:
- Scale-to-zero in production (KEDA + Azure Service Bus)
- Independent scaling from the API
- Proper job lifecycle management (retry, dead-letter)
- Local dev with NATS JetStream (lightweight, no cloud dependencies)

## What Changes

- New service: `applications/backend/synthesis/` (NestJS)
- New abstraction: `QueueService` interface with two implementations:
  - `NatsQueueService` (local, `QUEUE_DRIVER=nats`)
  - `ServiceBusQueueService` (prod, `QUEUE_DRIVER=service-bus`)
- API: removes synthesis execution, keeps status/files endpoints (reads directly from DB/storage)
- API: publishes `{ projectId }` message to queue when synthesis is triggered
- Synthesis service: subscribes to queue, runs AI synthesis, writes to storage, updates DB status
- `docker-compose.yml`: adds NATS JetStream container, adds synthesis service
- Production: synthesis deployed as Container App with KEDA ScaledObject targeting Service Bus queue, `minReplicaCount: 0`

## Queue Contract

```
Queue name: synthesis-jobs
Message:    { projectId: string }
```

Synthesis service reads project context from storage, runs Anthropic API call, writes output back to storage, updates `synthStatus` in DB (`running` → `done` | `error`).

## Impact

- New: `applications/backend/synthesis/` service
- New: `QueueService` interface in shared lib or within each service
- Modified: API removes `SynthesisModule`, `SynthesisService` execution logic
- Modified: API `SynthesisController` keeps status/files endpoints unchanged
- Modified: `docker-compose.yml` adds NATS + synthesis service
- Prerequisite for: `api-azure-functions` (API becomes fully stateless)
