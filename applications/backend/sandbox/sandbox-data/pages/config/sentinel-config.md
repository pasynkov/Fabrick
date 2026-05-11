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
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
---

# Sentinel Configuration

`libs/sentinel` is the shared infrastructure library. Provides app bootstrap, typed config, health checks.

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
Standard NestJS NATS options: `NATS_SERVERS`, `NATS_QUEUE`, auth, etc.

### Kafka (Section: `kafka`)
Standard NestJS Kafka options: `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, `KAFKA_CLIENT_ID`, `KAFKA_TRANSACTIONAL_ID`, `KAFKA_IDEMPOTENT`, etc.

### Postgres (Section: `postgres`)
TypeORM datasource options: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`.

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
- [Assets Registry](../apps/assets-registry.md) — uses NATS transport
- [Harvester Conductor](../apps/harvester-conductor.md) — uses NATS + Kafka transports
- [Harvester Reaper](../apps/harvester-reaper.md) — uses NATS + Kafka transports
- [Environment Config](../config/environment.md) — Kubernetes ConfigMaps that supply env vars
