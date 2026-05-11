---
slug: contracts/nats-subjects
category: contracts
title: NATS Subjects
sources:
  - backend1
related:
  - contracts/kafka-topics
  - apps/assets-registry
  - apps/harvester-conductor
  - apps/binance-vision-connector
  - apps/nasdaq-cloud-storage-connector
  - transport/nats
---

# NATS Subjects

All NATS message subjects defined in `libs/transport/nats/`. Subject namespace built with `ns()` helper (dot-delimited).

## Assets Subjects

Served by: `apps/assets/registry`

| Subject | Type | Request | Response |
|---------|------|---------|----------|
| `assets.get-instrument` | MessagePattern | `{ id: number }` | `Instrument` |
| `assets.find-instrument` | MessagePattern | `{ marketName?, pairSymbol?, type? }` | `Instrument` |
| `assets.find-instruments` | MessagePattern | `{ marketName?, pairSymbol?, type?, skip, limit, stream? }` | `{ instruments, count, skip, limit }` |
| `assets.create-asset` | MessagePattern | — | — |

`find-instruments` supports streaming mode: when `stream=true` and `skip=0`, returns an `Observable` that emits paginated pages in parallel using `mergeMap`.

## Harvester Subjects

Served by: `apps/harvester/conductor`

| Subject | Type | Request | Response |
|---------|------|---------|----------|
| `harvester.start-harvest` | MessagePattern | `{ instrumentId, from, to }` | `{ id }` |
| `harvester.get-harvest` | MessagePattern | `{ id }` | `Harvest` |

## Binance Vision Subjects

Served by: `apps/binance/vision-connector`

| Subject | Type | Request | Response |
|---------|------|---------|----------|
| `crypto.cex.binance.vision.get-trades` | MessagePattern | `{ base, quote, year, month, day, batchSize }` | `{ trades: Trade[] }` (streamed) |

## NASDAQ Cloud Storage Subjects

Served by: `apps/nasdaq/cloud-storage-connector`

| Subject | Type | Request | Response |
|---------|------|---------|----------|
| `stock.nasdaq.cloud-storage.get-trades` | MessagePattern | `{ base, quote, year, month, day, batchSize }` | `{ trades: Trade[] }` (streamed) |

## Subject Namespace Hierarchy

```
assets.*
harvester.*
crypto.cex.binance.vision.*
stock.nasdaq.cloud-storage.*
```

## Related Pages
- [Kafka Topics](../contracts/kafka-topics.md) — async event subjects
- [NATS Cluster](../transport/nats.md) — infrastructure serving these subjects
- [Assets Registry](../apps/assets-registry.md) — assets subjects handler
- [Harvester Conductor](../apps/harvester-conductor.md) — harvester subjects handler
- [Binance Vision Connector](../apps/binance-vision-connector.md) — Binance trades handler
- [NASDAQ Cloud Storage Connector](../apps/nasdaq-cloud-storage-connector.md) — NASDAQ trades handler
