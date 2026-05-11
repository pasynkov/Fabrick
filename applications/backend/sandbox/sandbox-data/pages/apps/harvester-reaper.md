---
slug: apps/harvester-reaper
category: apps
title: Harvester Reaper
sources:
  - backend1
  - kustomize
related:
  - logic/harvest-flow
  - logic/trade-transfer
  - contracts/kafka-topics
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
  - config/sentinel-config
  - entities/applications
  - config/environment
---

# Harvester Reaper

NestJS microservice. Kafka consumer for `harvester.reap`. Fetches trade data per period, stages to GCS, loads to BigQuery, reports back.

**Path:** `apps/harvester/reaper`  
**Image:** `pasynkov/namico-harvester-reaper`  
**Transports:** NATS (outgoing queries) + Kafka (incoming work + outgoing report)  
**Replicas:** 4 (Recreate strategy)

## Responsibilities

- Consume `harvester.reap` Kafka topic (one message = one day period)
- Fetch trades from source connector via NATS (Binance Vision or NASDAQ)
- Upload trade batches to GCS bucket `trades_jsonl` as JSONL
- Archive batch files into single file per period using GCS compose
- Load archive to BigQuery `trades_raw.trades`
- Report completion via Kafka `harvester.report` (inside same transaction)

## Kafka Consumer

Topic: `harvester.reap`  
Handler: `ReapController.reap(payload)`

Uses custom `ContextIdStrategy` for per-message DI scope isolation.

## Configuration (`ReaperConfig`)

| Env Var | Default (code) | Kubernetes Value | Description |
|---------|----------------|-----------------|-------------|
| `REAPER_NATS_BATCH_SIZE` | 5000 | 10000 | Trades per NATS response batch |
| `REAPER_KAFKA_BATCH_SIZE` | 3000 | 7000 | Trades per GCS upload chunk |
| `REAPER_KAFKA_PARALLEL_WRITES` | 10 | 10 | Concurrent GCS uploads |
| `REAPER_GCP_BUCKET_NAME` | — | `trades_jsonl` | GCS bucket for staged trades |
| `KAFKA_TRANSACTIONAL_ID` | — | pod name | Unique per-replica transaction ID |
| `KAFKA_IDEMPOTENT` | — | `true` | Idempotent producer |

## GCS File Layout

```
{market}/{type}/{pair}/{yyyy}/{mm}/{dd}/{from}-{to}.jsonl          ← final archive
{market}/{type}/{pair}/{yyyy}/{mm}/{dd}/{periodId}_{rnd}_{from}.jsonl  ← temp chunks
```

Bucket: `trades_jsonl`

## Graceful Shutdown

`onApplicationShutdown()` emits `destroy$` → active RxJS pipeline stops → Kafka transaction aborted → `KafkaRetriableException` thrown → Kafka re-delivers message.

## Kubernetes Configuration

Resources: 250m CPU / 1Gi memory (request) → 1150m CPU / 2Gi memory (limit)  
Mounts GCP key at `/etc/secrets/key.json`.

## Related Pages
- [Harvest Flow](../logic/harvest-flow.md) — orchestration context
- [Trade Transfer](../logic/trade-transfer.md) — detailed trade fetch and staging
- [Kafka Topics](../contracts/kafka-topics.md) — topics consumed and produced
- [Binance Vision Connector](../apps/binance-vision-connector.md) — trade data source
- [NASDAQ Cloud Storage Connector](../apps/nasdaq-cloud-storage-connector.md) — trade data source
- [Kubernetes Applications](../entities/applications.md) — deployment spec

---
