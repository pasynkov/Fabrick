---
slug: apps/binance-vision-connector
category: apps
title: Binance Vision Connector
sources:
  - backend1
  - kustomize
related:
  - logic/trade-transfer
  - contracts/nats-subjects
  - config/sentinel-config
  - entities/applications
  - config/environment
---

# Binance Vision Connector

NestJS microservice. Serves Binance spot trade data via NATS. Sources from GCS cache or data.binance.vision HTTP.

**Path:** `apps/binance/vision-connector`  
**Image:** `pasynkov/namico-binance-vision`  
**Transport:** NATS only  
**Replicas:** 4 (RollingUpdate: maxUnavailable 2, maxSurge 1)

## Responsibilities

- Listen on `crypto.cex.binance.vision.get-trades`
- Fetch daily trade CSV ZIP from Binance public data archive (or GCS cache)
- Parse CSV, return batched trades to caller

## NATS Handler

Subject: `crypto.cex.binance.vision.get-trades`

Request: `{ base, quote, year, month, day, batchSize }`  
Response (streamed): `{ trades: Row[] }`

## Data Flow

```
NATS request
  → build URL: spot/daily/trades/{BTCUSDT}/{BTCUSDT}-trades-{date}.zip
  → check GCS bucket (binance_vision)
    hit:  read ZIP from GCS
    miss: HTTP GET from data.binance.vision + tee-write to GCS
  → unzip in-memory (unzipper)
  → parse CSV (csv-parser, no headers)
  → bufferCount(batchSize)
  → emit batches via NATS Observable
```

On 404 from Binance: returns empty (day has no data).

## CSV Format

Headers mapped positionally: `TradeId, Price, Quantity, QuoteQuantity, Timestamp, IsBuyerMaker, IsBestMatch`

## Kubernetes Configuration

| Env Var | Value |
|---------|-------|
| `NATS_QUEUE` | `binance-vision` |
| `TRANSPORTS` | `nats` |
| `BINANCE_VISION_STORAGE_GCP_BUCKET_NAME` | `binance_vision` |

Resources: 250m CPU / 512Mi memory (request) → 1150m CPU / 1Gi memory (limit)  
Mounts GCP key at `/etc/secrets/key.json`.

## Related Pages
- [Trade Transfer](../logic/trade-transfer.md) — how the reaper calls this service
- [NATS Subjects](../contracts/nats-subjects.md) — full subject contract
- [Kubernetes Applications](../entities/applications.md) — deployment spec

---
