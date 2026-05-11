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
  - config/environment
  - entities/applications
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

PostgreSQL. Database: `harvester`. Migrations in `src/database/migrations/`:
- `1757076547237-init` — create `harvests` and `harvest_periods` tables

## Kubernetes Configuration

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `harvester-conductor` |
| `TRANSPORTS` | `nats,kafka` |
| `KAFKA_CLIENT_ID` | `harvest-conductor-client` |
| `KAFKA_GROUP_ID` | `harvest-conductor-group` |
| `POSTGRES_DATABASE` | `harvester` |

Resources: 125m/256Mi req → 1150m/512Mi limit  
Mounts GCP key at `/etc/secrets/key.json`

## Related Pages
- [Harvest & Period Entities](../entities/harvest.md) — DB entities owned by this service
- [Harvest Flow](../logic/harvest-flow.md) — full orchestration lifecycle
- [BigQuery Pipeline](../transport/bigquery-pipeline.md) — forecast SQL queries
- [NATS Subjects](../contracts/nats-subjects.md) — subjects handled
- [Kafka Topics](../contracts/kafka-topics.md) — topics produced/consumed
- [Environment Config](../config/environment.md) — Postgres, Kafka, GCP ConfigMaps
