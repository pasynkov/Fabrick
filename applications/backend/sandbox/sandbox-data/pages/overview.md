---
slug: overview
category: overview
title: System Overview
sources:
  - backend1
  - kustomize
related:
  - apps/assets-registry
  - apps/harvester-conductor
  - apps/harvester-reaper
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
  - contracts/nats-subjects
  - contracts/kafka-topics
  - transport/bigquery-pipeline
  - config/environment
---

# System Overview

Nami is a trade data harvesting platform that collects historical trade records from Binance (crypto) and NASDAQ (equities), stages them to Google Cloud Storage, loads them to BigQuery, and runs an analytics/forecast pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes: harvester ns                      │
│                                                                 │
│  ┌──────────────────┐   NATS    ┌──────────────────────────┐   │
│  │  assets-registry │◄─────────►│  harvester-conductor     │   │
│  │  (PostgreSQL)    │           │  (PostgreSQL + BigQuery)  │   │
│  └──────────────────┘           └────────────┬─────────────┘   │
│                                              │ Kafka            │
│  ┌──────────────────┐                        │ harvester.reap   │
│  │  binance-vision  │◄──────┐  ┌─────────────▼─────────────┐   │
│  │  (GCS cache)     │  NATS │  │  harvester-reaper (x4)    │   │
│  └──────────────────┘       │  │  (GCS → BigQuery)         │   │
│                             ├──┤                           │   │
│  ┌──────────────────┐       │  └─────────────┬─────────────┘   │
│  │  nasdaq-cloud-   │◄──────┘                │ Kafka            │
│  │  storage (GCS)   │                        │ harvester.report │
│  └──────────────────┘                        │                  │
│                                              ▼                  │
│  NATS Cluster (in-cluster)   Kafka (external: kafka-server.     │
│  nats-cluster:4222           internal.namico.io:9092)           │
└─────────────────────────────────────────────────────────────────┘
                           │
                    BigQuery (GCP)
                    trades_raw.trades
                    trades_raw.windows
                    trades_raw.forecasts
                    trades_raw.instruments
```

## Services

| Service | Replicas | Transport | Storage |
|---------|----------|-----------|---------|
| assets-registry | 1 | NATS | PostgreSQL (`assets_registry`) |
| harvester-conductor | 1 | NATS + Kafka | PostgreSQL (`harvester`) + BigQuery |
| harvester-reaper | 4 | NATS + Kafka | GCS (`trades_jsonl`) + BigQuery |
| binance-vision | 4 | NATS | GCS (`binance_vision`) |
| nasdaq-cloud-storage | 4 | NATS | GCS (`nasdaq-trades`) |

## End-to-End Data Flow

1. **Start**: Client sends NATS `harvester.start-harvest` → Conductor creates Harvest + day-granularity Periods, dispatches to Kafka `harvester.reap`
2. **Reap**: Reaper consumes one period per message → queries connector (Binance Vision or NASDAQ) via NATS for trade batches → uploads JSONL to GCS → archives → loads to BigQuery `trades_raw.trades`
3. **Report**: Reaper sends `harvester.report` Kafka event (inside same transaction) → Conductor marks period completed
4. **Await**: When all periods complete, Conductor polls BigQuery every 60s verifying trade count
5. **Pipeline**: On count match, Conductor runs `fillWindows → fillForecasts → fillInstruments` BigQuery queries sequentially
6. **Complete**: Harvest status → `completed`

## GCS Buckets

| Bucket | Owner | Purpose |
|--------|-------|---------|
| `binance_vision` | binance-vision | Cache for Binance ZIP downloads |
| `nasdaq-trades` | nasdaq-cloud-storage | Pre-staged NASDAQ CSV data |
| `trades_jsonl` | harvester-reaper | Staged trade JSONL files before BQ load |

## Infrastructure

- **NATS**: In-cluster Helm deployment, max payload 300 MB, queue-subscribed for load balancing
- **Kafka**: External (`kafka-server.internal.namico.io:9092`); reaper uses Kafka transactions for exactly-once semantics
- **PostgreSQL**: External (`postgres.internal.namico.io:5432`)
- **BigQuery**: GCP project `cs-poc-xyd1uouxnw27ehczhe6rxby`, dataset `trades_raw`
- **Monitoring**: Grafana with BigQuery + Postgres datasources at `grafana.internal.namico.io`

## Related Pages
- [NATS Subjects](contracts/nats-subjects.md) — all message contracts
- [Kafka Topics](contracts/kafka-topics.md) — async event contracts
- [Harvest Flow](logic/harvest-flow.md) — detailed orchestration steps
- [BigQuery Pipeline](transport/bigquery-pipeline.md) — analytics queries

## Related Pages
- [NATS Subjects](contracts/nats-subjects.md) — All NATS request/response message contracts
- [Kafka Topics](contracts/kafka-topics.md) — Async harvest event contracts
- [Harvest Flow](logic/harvest-flow.md) — Detailed end-to-end orchestration
- [BigQuery Pipeline](transport/bigquery-pipeline.md) — Post-ingestion analytics queries
- [Environment / ConfigMaps](config/environment.md) — Kubernetes environment configuration

---
