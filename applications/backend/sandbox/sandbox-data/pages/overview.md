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
  - transport/nats
  - transport/kafka
  - transport/bigquery-pipeline
  - config/environment
---

# System Overview

Nami is a trade data harvesting pipeline that collects historical trade data from Binance (crypto) and NASDAQ (equities), stages it to Google Cloud Storage, loads it to BigQuery, and runs an analytics/forecast pipeline.

## Architecture

```
External Client
  │
  ▼ NATS
┌─────────────────────┐
│  Assets Registry    │ ◄─── NATS: assets.*
│  (PostgreSQL)       │      instrument reference data
└─────────────────────┘

┌─────────────────────┐
│ Harvester Conductor │ ◄─── NATS: harvester.*
│  (PostgreSQL)       │      orchestrates harvest jobs
└────────┬────────────┘
         │ Kafka: harvester.reap
         ▼
┌─────────────────────┐      NATS: crypto.cex.binance.vision.get-trades
│  Harvester Reaper   │ ──► Binance Vision Connector ──► GCS (binance_vision cache)
│  (×4 replicas)      │
│                     │      NATS: stock.nasdaq.cloud-storage.get-trades
│                     │ ──► NASDAQ Cloud Storage Connector ──► GCS (nasdaq-trades)
│                     │
│                     │ ──► GCS (trades_jsonl) ──► BigQuery (trades_raw.trades)
└────────┬────────────┘
         │ Kafka: harvester.report
         ▼
┌─────────────────────┐
│ Harvester Conductor │ ──► BigQuery: fillWindows → fillForecasts → fillInstruments
└─────────────────────┘
```

## Services

| Service | Replicas | Transports | Storage |
|---------|----------|-----------|---------|
| Assets Registry | 1 | NATS | PostgreSQL (`assets_registry`) |
| Harvester Conductor | 1 | NATS + Kafka | PostgreSQL (`harvester`) + BigQuery |
| Harvester Reaper | 4 | NATS (out) + Kafka (in+out) | GCS + BigQuery |
| Binance Vision Connector | 4 | NATS | GCS (`binance_vision`) |
| NASDAQ Cloud Storage Connector | 4 | NATS | GCS (`nasdaq-trades`) |

## Data Flow Summary

1. **Start**: Client sends `harvester.start-harvest` via NATS to Conductor
2. **Dispatch**: Conductor creates Harvest + day-granularity Periods, emits all to Kafka `harvester.reap`
3. **Reap**: Each Reaper picks up a period, fetches trades from the appropriate connector (Binance or NASDAQ) via NATS, uploads JSONL batches to GCS `trades_jsonl`, archives, loads to BigQuery `trades_raw.trades`
4. **Report**: Reaper sends `harvester.report` Kafka event (inside same Kafka transaction as load)
5. **Await**: Conductor marks periods complete; when all done, polls BigQuery trade count vs expected
6. **Pipeline**: On count match, Conductor runs BigQuery analytics: fillWindows → fillForecasts → fillInstruments
7. **Complete**: Harvest status set to `completed`

## Infrastructure

- **Namespace**: `harvester` (Kubernetes)
- **NATS**: In-cluster cluster (Helm), `nats-cluster-headless.harvester.svc.cluster.local:4222`, max payload 300MB
- **Kafka**: External broker at `kafka-server.internal.namico.io:9092`
- **PostgreSQL**: External at `postgres.internal.namico.io:5432`
- **GCP Project**: `cs-poc-xyd1uouxnw27ehczhe6rxby`
- **BigQuery dataset**: `trades_raw`
- **Monitoring**: Grafana with BigQuery + Postgres datasources

## Related Pages
- [NATS Subjects](contracts/nats-subjects.md) — all message contracts
- [Kafka Topics](contracts/kafka-topics.md) — async event contracts
- [Harvest Flow](logic/harvest-flow.md) — detailed orchestration steps
- [Deploy Flow](logic/deploy-flow.md) — Kubernetes deployment procedure
