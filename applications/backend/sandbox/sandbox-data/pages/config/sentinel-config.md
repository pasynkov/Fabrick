---
slug: config/sentinel-config
category: config
title: Sentinel Configuration
sources:
  - backend1
related:
  - apps/assets-registry
  - apps/harvester-conductor
  - apps/harvester-reaper
---

# Sentinel Configuration

`libs/sentinel` is the shared infrastructure library. Provides app bootstrap, typed config, and health checks for all NestJS microservices.

## Sentinel Bootstrap Pattern

Each app uses `Sentinel` class:

```ts
const sentinel = new Sentinel(options);
await sentinel.create();             // creates internal Fastify health/status app
await sentinel.connectApplication(AppModule);  // creates main NestJS app
await sentinel.start();              // wires transports, starts all microservices
```

`start()` reads `GlobalConfig.transports` to decide which transports to connect:
- `nats` → connects NATS microservice (pingInterval=30s, maxPingOut=5)
- `kafka` → connects Kafka microservice with app-specific run options

## Environment Variables

### Global (Section: `global`)
| Var | Default | Description |
|-----|---------|-------------|
| `TRANSPORTS` | `nats` | Comma-separated: `nats`, `kafka` |
| `DATABASES` | `[]` | Comma-separated DB identifiers |

### NATS (Section: `nats`)
Standard NestJS NATS options: servers, auth, queue, etc.

### Kafka (Section: `kafka`)
Standard NestJS Kafka options: brokers, groupId, clientId, transactionalId, idempotent, etc.

### Postgres (Section: `postgres`)
TypeORM datasource options: host, port, username, password, database.

## Health Checks

`SentinelController` exposes HTTP health endpoint (Fastify app, default port 3000) at `GET /healthy`.  
`HealthCheckerModule` provides pluggable checkers:
- `NatsHealthChecker`
- `PostgresHealthChecker`

Connections to check are declared in `sentinel.options.connections`.

## SentinelOptions Interface

```ts
{
  port?: number           // health app port, default 3000
  config?: ConfigOptions  // config module options
  connections?: SentinelConnection[]  // health check targets
  kafka?: { run?: KafkaRunConfig }
  contextIdStrategy?: ContextIdStrategy  // DI scope strategy
}
```

## Related Pages
- [Assets Registry](../apps/assets-registry.md) — uses Sentinel with NATS transport
- [Harvester Conductor](../apps/harvester-conductor.md) — uses Sentinel with NATS + Kafka
- [Harvester Reaper](../apps/harvester-reaper.md) — uses Sentinel with custom ContextIdStrategy

---
