---
slug: overview
category: overview
title: System Overview
sources:
  - backend1
  - kustomize
  - repo-a
  - repo-b
related:
  - apps/assets-registry
  - apps/harvester-conductor
  - apps/harvester-reaper
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
  - contracts/nats-subjects
  - contracts/kafka-topics
  - transport/nats
  - transport/kafka
  - transport/bigquery-pipeline
  - config/environment
---

# System Overview

Trade data harvesting platform. Collects historical trade data for financial instruments (crypto + equities), stages to Google Cloud Storage, loads to BigQuery, then runs an analytics/forecast pipeline.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes: harvester namespace               │
│                                                                  │
│  ┌──────────────────┐   NATS    ┌─────────────────────────┐    │
│  │  assets-registry │◄──────────│   harvester-conductor   │    │
│  │  (1 replica)     │           │   (1 replica, Recreate) │    │
│  └──────────────────┘           └──────────┬──────────────┘    │
│         │ PostgreSQL                        │ Kafka             │
│         │ assets_registry                   │ harvester.reap    │
│         │                                   ▼                   │
│  ┌──────────────────┐    NATS  ┌─────────────────────────┐    │
│  │ binance-vision   │◄─────────│  harvester-reaper       │    │
│  │ (4 replicas)     │          │  (4 replicas, Recreate) │    │
│  └──────────────────┘          └──────────┬──────────────┘    │
│  ┌──────────────────┐    NATS             │                    │
│  │ nasdaq-cloud-    │◄────────────────────┘                    │
│  │ storage (4 rep.) │    Kafka: harvester.report ──────────►  │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
         │ GCS                    │ GCS (trades_jsonl)
         │ binance_vision         │
         ▼                        ▼
  data.binance.vision      BigQuery: trades_raw.trades
                                   │
                           fillWindows / fillForecasts / fillInstruments
                                   │
                                   ▼
                            BigQuery: windows, forecasts, instruments
```

## Component Summary

| Component | Replicas | Transport | Storage |
|-----------|----------|-----------|---------|
| assets-registry | 1 | NATS | PostgreSQL (`assets_registry`) |
| harvester-conductor | 1 | NATS + Kafka | PostgreSQL (`harvester`) + BigQuery |
| harvester-reaper | 4 | NATS + Kafka | GCS + BigQuery |
| binance-vision-connector | 4 | NATS | GCS (`binance_vision`) |
| nasdaq-cloud-storage-connector | 4 | NATS | GCS (`nasdaq-trades`) |

## Data Flow Summary

1. **Start**: Client sends `harvester.start-harvest` NATS message to Conductor
2. **Plan**: Conductor creates Harvest + day-granularity Period records in PostgreSQL; emits batch to Kafka `harvester.reap`
3. **Fetch**: Each Reaper instance consumes one period; queries Binance Vision or NASDAQ connector via NATS
4. **Stage**: Reaper uploads trade batches as JSONL to GCS (`trades_jsonl`), archives into single file
5. **Load**: Reaper loads archive to BigQuery `trades_raw.trades`; reports via Kafka `harvester.report`
6. **Verify**: Conductor polls BigQuery every 60s; compares count vs expected
7. **Analyze**: When complete, Conductor runs `fillWindows → fillForecasts → fillInstruments` in BigQuery

## Infrastructure

- **Message Bus**: In-cluster NATS (Helm `nats` v1.3.6), max payload 300 MB
- **Event Queue**: External Kafka at `kafka-server.internal.namico.io:9092`
- **Databases**: PostgreSQL at `postgres.internal.namico.io:5432`
- **Cloud**: GCP project `cs-poc-xyd1uouxnw27ehczhe6rxby` — GCS + BigQuery
- **Monitoring**: Grafana (Helm) with BigQuery + Postgres datasources
- **Auth/Gateway**: JWT-based auth service (repo-a) proxied by API gateway (repo-b)

## Related Pages
- [Harvest Flow](logic/harvest-flow.md) — detailed step-by-step orchestration
- [NATS Subjects](contracts/nats-subjects.md) — all message subjects
- [Kafka Topics](contracts/kafka-topics.md) — async event contracts
- [Environment Config](config/environment.md) — all environment variables

## Related Pages
- [Harvest Flow](logic/harvest-flow.md) — Detailed end-to-end orchestration
- [NATS Subjects](contracts/nats-subjects.md) — All message subjects
- [Kafka Topics](contracts/kafka-topics.md) — Async event contracts
- [Environment Config](config/environment.md) — All environment variables
