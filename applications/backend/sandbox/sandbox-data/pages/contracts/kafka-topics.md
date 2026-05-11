---
slug: contracts/kafka-topics
category: contracts
title: Kafka Topics
sources:
  - backend1
  - kustomize
related:
  - contracts/nats-subjects
  - logic/harvest-flow
  - apps/harvester-conductor
  - apps/harvester-reaper
  - transport/kafka
---

# Kafka Topics

Kafka topics defined in `libs/transport/kafka/`. Used for async work distribution in the harvest pipeline. Broker: `kafka-server.internal.namico.io:9092`.

## Harvester Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `harvester.reap` | Conductor | Reaper | Dispatch period reap jobs |
| `harvester.report` | Reaper | Conductor | Report period completion with trade count |

### harvester.reap

Message key + value (sent as batch via `emitBatch`):

```ts
// Key
{ harvestId: number, periodId: number }

// Value
{
  id: number           // period id
  instrumentId: number
  harvestId: number
  from: number         // unix epoch seconds
  to: number           // unix epoch seconds
}
```

### harvester.report

```ts
{
  periodId: number
  count: number        // trade count loaded to BigQuery
}
```

Sent inside the Kafka transaction that also committed the BigQuery load, ensuring exactly-once semantics between load and reporting.

## Transaction Pattern

Reaper uses Kafka transactions (`producer.transaction()`) that span:
1. The BigQuery GCS load operation
2. The `harvester.report` event

On application shutdown (`onApplicationShutdown`), the active transaction is aborted and a `KafkaRetriableException` is thrown so Kafka re-delivers the message.

## Infrastructure Topics (Kafka Connect — disabled)

| Topic | Purpose |
|-------|---------|
| `trades` | Kafka BigQuery Connect sink source (currently disabled) |
| `dlq-bigquery-trades` | Dead-letter for failed BigQuery loads |
| `_connect-configs` | Kafka Connect internal |
| `_connect-offsets` | Kafka Connect internal |
| `_connect-status` | Kafka Connect internal |

## Related Pages
- [NATS Subjects](../contracts/nats-subjects.md) — synchronous request/response contracts
- [Harvest Flow](../logic/harvest-flow.md) — how topics fit into the pipeline
- [Harvester Conductor](../apps/harvester-conductor.md) — topic producer/consumer
- [Harvester Reaper](../apps/harvester-reaper.md) — topic consumer/producer
- [Kafka Infrastructure](../transport/kafka.md) — broker and Kafka UI details
