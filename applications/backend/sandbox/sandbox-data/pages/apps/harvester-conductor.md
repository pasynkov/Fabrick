---
slug: apps/harvester-conductor
category: apps
title: Harvester Conductor
sources:
  - backend1
  - kustomize
related:
  - entities/harvest
  - logic/harvest-flow
  - transport/bigquery-pipeline
  - contracts/nats-subjects
  - contracts/kafka-topics
  - config/sentinel-config
  - entities/applications
  - config/environment
---

# Harvester Conductor

NestJS microservice. Orchestrates harvest jobs. Owns the `harvests` and `harvest_periods` tables. Runs the BigQuery forecast pipeline.

**Path:** `apps/harvester/conductor`  
**Image:** `pasynkov/namico-harvester-conductor`  
**Transports:** NATS (requests) + Kafka (events)  
**Replicas:** 1 (Recreate strategy)

## Responsibilities

- Accept harvest start requests via NATS
- Create `Harvest` and day-granularity `Period` records
- Dispatch periods to Kafka topic `harvester.reap` as a batch
- Listen for `harvester.report` Kafka events; update period status
- Poll every 60s for `awaiting` harvests; verify BigQuery trade count
- Run forecast pipeline (fillWindows → fillForecasts → fillInstruments) when complete

## NATS Handlers

| Subject | Method |
|---------|--------|
| `harvester.start-harvest` | `HarvestController.start` |
| `harvester.get-harvest` | `HarvestController.getHarvester` |

## Kafka Handlers

| Topic | Method |
|-------|--------|
| `harvester.report` | `HarvestController.report` |

## Key Services

**HarvestService:**
- `start()` — transactional: create harvest + periods + send to Kafka
- `report(periodId, count)` — mark period done; flip harvest to `awaiting` when all periods done
- `onApplicationBootstrap()` — starts 60s polling loop for `awaiting` harvests
- `runForecastPipeline(harvest)` — sequential BigQuery queries

**BigQueryService:**
- `getTradesCount()` — verify completeness before pipeline
- `fillWindows()`, `fillSignals()`, `fillForecasts()`, `fillInstruments()` — analytics queries

## Database

PostgreSQL (`harvester` DB). Migration:
- `1757076547237-init` — create `harvests` and `harvest_periods` tables

## Kubernetes Configuration

| Env Var | Value |
|---------|-------|
| `POSTGRES_DATABASE` | `harvester` |
| `NATS_QUEUE` | `harvester-conductor` |
| `TRANSPORTS` | `nats,kafka` |
| `KAFKA_CLIENT_ID` | `harvest-conductor-client` |
| `KAFKA_GROUP_ID` | `harvest-conductor-group` |

Resources: 125m CPU / 256Mi memory (request) → 1150m CPU / 512Gi memory (limit)  
Mounts GCP key at `/etc/secrets/key.json`.

## Related Pages
- [Harvest & Period Entities](../entities/harvest.md) — DB entities owned by this service
- [Harvest Flow](../logic/harvest-flow.md) — full orchestration lifecycle
- [BigQuery Pipeline](../transport/bigquery-pipeline.md) — analytics queries this service runs
- [NATS Subjects](../contracts/nats-subjects.md) — subjects handled by this service
- [Kafka Topics](../contracts/kafka-topics.md) — topics produced and consumed
- [Sentinel Config](../config/sentinel-config.md) — shared bootstrap library
- [Kubernetes Applications](../entities/applications.md) — deployment spec

---
