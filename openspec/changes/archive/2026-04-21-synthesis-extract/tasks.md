## 1. QueueService abstraction (shared)

- [x] 1.1 Define `QueueService` interface in `applications/backend/synthesis/src/queue/queue.interface.ts`
- [x] 1.2 Implement `NatsQueueService` using `nats` npm package with JetStream (`QUEUE_DRIVER=nats`, `NATS_URL` env var)
- [x] 1.3 Implement `ServiceBusQueueService` using `@azure/service-bus` (`QUEUE_DRIVER=service-bus`, `SERVICE_BUS_CONNECTION` env var)
- [x] 1.4 Create `QueueModule` with factory provider that selects implementation based on `QUEUE_DRIVER`

## 2. Synthesis service scaffold

- [x] 2.1 Create `applications/backend/synthesis/` with NestJS project structure
- [x] 2.2 Add `package.json` with dependencies: NestJS core, `nats`, `@azure/service-bus`, `typeorm`, `pg`, `minio`, `@anthropic-ai/sdk`
- [x] 2.3 Add `Dockerfile` and `tsconfig.json` (copy pattern from `applications/backend/api/`)
- [x] 2.4 Create `nest-cli.json`

## 3. Move synthesis execution logic

- [x] 3.1 Copy `MinioService` from API into synthesis service (read context files, write synthesis output, update status)
- [x] 3.2 Move `runSynthesis()` private method and all Anthropic API call logic from API `SynthesisService` into synthesis service `SynthesisProcessor`
- [x] 3.3 Move `synthesis-prompt.txt` asset into synthesis service
- [x] 3.4 `SynthesisProcessor` subscribes to `synthesis-jobs` queue via `QueueService` on module init
- [x] 3.5 On message: find project in DB, run synthesis, update `synthStatus` to `done` or `error`

## 4. API changes

- [x] 4.1 Add `QueueModule` to API (same abstraction, publishes only)
- [x] 4.2 In API `SynthesisService.triggerForProject()`: replace `this.runSynthesis(...)` spawn with `this.queueService.publish('synthesis-jobs', { projectId })`
- [x] 4.3 Remove Anthropic client, prompt file read, and `runSynthesis()` from API `SynthesisService`
- [x] 4.4 Keep `getStatus()` and `getFiles()` in API `SynthesisService` unchanged (reads DB/storage directly)
- [x] 4.5 Remove `@anthropic-ai/sdk` from API `package.json` (no longer needed in API)

## 5. docker-compose

- [x] 5.1 Add NATS service: `nats:2-alpine` with `-js` flag (JetStream), port 4222
- [x] 5.2 Add synthesis service with env: `QUEUE_DRIVER=nats`, `NATS_URL=nats://nats:4222`, DB + MinIO + `ANTHROPIC_API_KEY`
- [x] 5.3 Add `QUEUE_DRIVER=nats`, `NATS_URL=nats://nats:4222` to API service env
- [x] 5.4 Set synthesis `depends_on: [nats, postgres, minio]`
- [x] 5.5 Set API `depends_on` to add `nats`
