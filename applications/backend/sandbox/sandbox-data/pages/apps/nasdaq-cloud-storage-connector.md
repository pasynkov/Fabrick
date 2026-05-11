---
slug: apps/nasdaq-cloud-storage-connector
category: apps
title: NASDAQ Cloud Storage Connector
sources:
  - backend1
  - kustomize
related:
  - logic/trade-transfer
  - contracts/nats-subjects
  - config/sentinel-config
  - config/environment
  - entities/applications
---

# NASDAQ Cloud Storage Connector

NestJS microservice. Serves NASDAQ trade data from GCS bucket via NATS.

**Path:** `apps/nasdaq/cloud-storage-connector`  
**Image:** `pasynkov/namico-nasdaq-cloud-storage`  
**Transport:** NATS only  
**Replicas:** 4 (RollingUpdate, maxUnavailable: 0, maxSurge: 1)

## Responsibilities

- Listen on `stock.nasdaq.cloud-storage.get-trades`
- Read pre-staged NASDAQ CSV trade data from GCS
- Emit heartbeat empty arrays every 2s (NATS keepalive for slow reads)
- Return batched trades to caller

## NATS Handler

Subject: `stock.nasdaq.cloud-storage.get-trades`

Request: `{ base, quote, year, month, day, batchSize }`  
Response (streamed): `{ trades: Row[] }`

## Data Flow

```
NATS request
  → path: csv-zipped/{year}/{YYYY-MM-DD}/{symbol}.csv
  → if CSV missing → look for csv-zipped/{year}/{YYYY-MM-DD}.zip
      → unzip to same folder in GCS (resumable write per entry)
      → re-check CSV
  → if still missing → return null (no data for that day)
  → stream + parse CSV
  → bufferCount(batchSize) merged with heartbeat interval(2s)
  → emit batches
```

## CSV Format (NASDAQ trades)

Headers: `Timestamp, Price, Volume`. Timestamp is a float seconds value → converted to ms: `Math.round(parseFloat(ts) * 1000)`.

## Kubernetes Configuration

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `nasdaq-cloud-storage` |
| `TRANSPORTS` | `nats` |
| `NASDAQ_CLOUD_STORAGE_GCP_BUCKET_NAME` | `nasdaq-trades` |

Mounts GCP key at `/etc/secrets/key.json`

## Related Pages
- [Trade Transfer](../logic/trade-transfer.md) — how the reaper calls this connector
- [NATS Subjects](../contracts/nats-subjects.md) — subject contract
- [Environment Config](../config/environment.md) — GCP credentials ConfigMap
- [Deployed Applications](../entities/applications.md) — Kubernetes deployment details
