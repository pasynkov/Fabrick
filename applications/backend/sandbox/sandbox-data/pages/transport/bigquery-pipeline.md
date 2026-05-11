---
slug: transport/bigquery-pipeline
category: transport
title: BigQuery Pipeline
sources:
  - backend1
related:
  - logic/harvest-flow
  - logic/trade-transfer
---

# BigQuery Pipeline

Post-ingestion analytics pipeline run by `harvester/conductor` after all trade periods are loaded.

## Dataset Structure

Dataset: `trades_raw` (default dataset for all queries)

| Table | Description |
|-------|-------------|
| `trades` | Raw trade rows loaded by reaper |
| `windows` | Aggregated OHLCV-style windows |
| `signals` | Computed signals (currently disabled) |
| `forecasts` | Forecast outputs |
| `instruments` | Instrument dimension table |

## Pipeline Steps

Executed in sequence by `HarvestService.runForecastPipeline()`:

### 1. fillWindows
`BigQueryService.fillWindows(instrumentKey, from, to)`

Aggregates raw trades into time windows. Query from `fill-windows.query.ts`.

### 2. fillForecasts
`BigQueryService.fillForecasts(instrumentKey, from, to)`

Computes forecast values from windows. Uses `fill-forecasts-v2.query.ts` (v1 deprecated).  
`fillSignals` is currently commented out in the pipeline.

### 3. fillInstruments
`BigQueryService.fillInstruments(instrument)`

Upserts instrument metadata into the `instruments` dimension table. Query from `fill-instruments.query.ts`.

## BigQuery Client Usage

`BigQueryService.runQuery(query)`:
1. Creates a query job with `defaultDataset: trades_raw`
2. Polls job results via `job.getQueryResults()`
3. Logs bytes processed (in GB)

## Completion Check

Before running the pipeline, conductor verifies data completeness:

```sql
SELECT COUNT(DISTINCT trade_id) as cnt
FROM trades
WHERE instrument_key = '{instrumentKey}'
  AND timestamp >= TIMESTAMP_SECONDS({from})
  AND timestamp <= TIMESTAMP_SECONDS({to})
```

Expected count = sum of `period.trades` across all periods in the harvest. Pipeline runs only when `bigquery_count >= expected_count`.

## Related Pages
- [Harvest Flow](../logic/harvest-flow.md) — pipeline trigger context
- [Trade Transfer](../logic/trade-transfer.md) — how trades reach BigQuery

---
