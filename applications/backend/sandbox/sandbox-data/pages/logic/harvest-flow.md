---
slug: logic/harvest-flow
category: logic
title: Harvest Flow
sources:
  - backend1
related:
  - entities/harvest
  - logic/trade-transfer
  - transport/bigquery-pipeline
  - contracts/nats-subjects
  - contracts/kafka-topics
---

# Harvest Flow

End-to-end orchestration of trade data collection and BigQuery ingestion.

## Overview

```
Client
  → NATS: harvester.start-harvest
  → Conductor: creates Harvest + Periods, sends to Kafka (harvester.reap)
  → Reaper(s): fetch trades per period → GCS bucket → BigQuery load
  → Reaper: sends Kafka event (harvester.report)
  → Conductor: marks period completed, checks if all done
  → Conductor timer: polls BigQuery trade count vs expected
  → When count matches: runs forecast pipeline (fillWindows, fillForecasts, fillInstruments)
  → Harvest status: completed
```

## Step 1 — Start Harvest (Conductor)

NATS subject: `harvester.start-harvest`

```ts
HarvestService.start({ instrumentId, from, to })
```

1. Creates `Harvest` record (status=`new`)
2. Resolves instrument via NATS `assets.get-instrument`
3. Runs SQL `generate_series` to create day-granularity `Period` records in a transaction
4. Sends all periods as a batch to Kafka topic `harvester.reap` via `emitBatch`
5. Returns harvest object

## Step 2 — Reap Period (Reaper)

Kafka topic: `harvester.reap`

```ts
ReapService.reap(period, instrument, harvest)
```

1. Opens a Kafka transaction
2. Calls `transferTrades(instrument, period, kafkaTransaction)`
3. Checks GCS for existing trades file — if found, loads directly to BigQuery
4. Otherwise: streams trades via NATS from connector, uploads batches to GCS as `.jsonl` files
5. Archives batch files into single `{market}/{type}/{pair}/{yyyy}/{mm}/{dd}/{from}-{to}.jsonl`
6. Loads archive to BigQuery (`trades_raw.trades` table)
7. Sends `harvester.report` Kafka event with `{periodId, count}` inside the same transaction
8. Commits transaction

## Step 3 — Report & Await (Conductor)

Kafka event: `harvester.report`

```ts
HarvestService.report(periodId, count)
```

1. Marks period `completed`, sets `trades = count`
2. If all periods done → harvest status → `awaiting`

## Step 4 — BigQuery Completion Check (Conductor)

Interval: every 60 seconds. Checks all `awaiting` harvests.

- If BigQuery rows ≥ expected count → runs `runForecastPipeline()` → status `completed`
- If >1h elapsed without match → status `error`

## Step 5 — Forecast Pipeline

```ts
HarvestService.runForecastPipeline(harvest)
```

Runs BigQuery queries in sequence:
1. `fillWindows(instrumentKey, from, to)` — aggregate trade windows
2. `fillForecasts(instrumentKey, from, to)` — compute forecasts
3. `fillInstruments(instrument)` — upsert instrument metadata

## Error Handling

- Reaper uses Kafka transactions: abort on error, throw `KafkaRetriableException` on shutdown
- Conductor rolls back DB transaction on `start()` failure
- HTTP exceptions from NATS are re-thrown with original status code

## Related Pages
- [Harvest & Period](../entities/harvest.md) — DB entities
- [Trade Transfer](../logic/trade-transfer.md) — per-period trade fetching detail
- [BigQuery Pipeline](../transport/bigquery-pipeline.md) — forecast SQL queries
- [NATS Subjects](../contracts/nats-subjects.md) — message contracts
- [Kafka Topics](../contracts/kafka-topics.md) — event contracts
