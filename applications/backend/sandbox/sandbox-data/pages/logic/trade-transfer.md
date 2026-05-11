---
slug: logic/trade-transfer
category: logic
title: Trade Transfer
sources:
  - backend1
related:
  - logic/harvest-flow
  - transport/bigquery-pipeline
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
---

# Trade Transfer

Per-period trade data collection: fetching from source connectors, staging to GCS, loading to BigQuery.

## Data Sources

| Market | Connector | NATS Subject |
|--------|-----------|-------------|
| Binance | `binance/vision-connector` | `crypto.cex.binance.vision.get-trades` |
| NASDAQ | `nasdaq/cloud-storage-connector` | `stock.nasdaq.cloud-storage.get-trades` |

Request payload for both: `{ base, quote, year, month, day, batchSize }`.  
Response: `{ trades: Trade[] }` streamed in batches.

## Binance Vision Connector

Source: [data.binance.vision](https://data.binance.vision) spot daily trades CSV ZIPs.

```
URL pattern: spot/daily/trades/{symbol}/{symbol}-trades-{date}.zip
```

1. Checks GCS bucket for existing ZIP — cache hit → reads from GCS
2. Cache miss → HTTP GET from Binance, tee-streams: write to GCS + parse simultaneously
3. Unzips in-memory → parses CSV (no header row, mapped manually)
4. Returns `bufferCount(batchSize)` batches

CSV columns: `TradeId, Price, Quantity, QuoteQuantity, Timestamp, IsBuyerMaker, IsBestMatch`

## NASDAQ Cloud Storage Connector

Source: GCS bucket with CSV files (pre-staged external data).

```
Path pattern: csv-zipped/{year}/{date}/{symbol}.csv
              csv-zipped/{year}/{date}.zip  (fallback — unzipped on first access)
```

1. Checks for CSV file; if missing, looks for ZIP → unzips to same folder in GCS
2. Parses CSV with headers: `Timestamp, Price, Volume`
3. Emits heartbeat empty arrays every 2s (NATS keepalive during slow reads)

## GCS Staging (Reaper)

Bucket: `trades_jsonl`

Trade batch upload flow:
1. Map trades to JSONL format: `{instrument_key, trade_id, price, volume, timestamp}`
2. Upload each batch as `{market}/{type}/{pair}/{yyyy}/{mm}/{dd}/{periodId}_{rnd}_{from}.jsonl`
3. After all batches uploaded, `archiveFiles()` combines into single file using GCS `compose` API
   - Files >32: recursive chunked combine (GCS compose limit is 32 sources)
4. Single archive: `{market}/{type}/{pair}/{yyyy}/{mm}/{dd}/{from}-{to}.jsonl`
5. Load archive to BigQuery via `table.load()` with `WRITE_APPEND`

## BigQuery Schema (trades table)

Dataset: `trades_raw`, Table: `trades`

| Field | Type | Mode |
|-------|------|------|
| instrument_key | STRING | REQUIRED |
| trade_id | INT64 | REQUIRED |
| price | NUMERIC | REQUIRED |
| volume | NUMERIC | REQUIRED |
| timestamp | TIMESTAMP | REQUIRED |

## Related Pages
- [Harvest Flow](../logic/harvest-flow.md) — orchestration context
- [BigQuery Pipeline](../transport/bigquery-pipeline.md) — post-load analytics queries
- [Binance Vision Connector](../apps/binance-vision-connector.md) — Binance trade source
- [NASDAQ Cloud Storage Connector](../apps/nasdaq-cloud-storage-connector.md) — NASDAQ trade source

---
