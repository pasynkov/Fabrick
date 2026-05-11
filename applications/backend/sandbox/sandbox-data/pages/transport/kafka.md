---
slug: transport/kafka
category: transport
title: Kafka
sources:
  - kustomize
related:
  - entities/applications
  - config/environment
  - infra/kafka-bigquery-connect
  - contracts/kafka-topics
---

# Kafka

Kafka is **external** (not in-cluster). Broker at `kafka-server.internal.namico.io:9092`.

## Kafka UI

Web UI (`provectuslabs/kafka-ui:latest`) for inspecting topics, consumer groups, etc.

- **Replicas**: 1 | **Strategy**: Recreate
- **Ingress**: `kafka.internal.namico.io` (GCE internal LB)
- **Resources**: 250m/256Mi req → 500m/512Mi limit

Reads broker config from `kafka-brokers-configmap`.

## Topics

| Topic | Producer | Consumer | Notes |
|-------|----------|----------|-------|
| `harvester.reap` | Conductor | Reaper | Period work dispatch |
| `harvester.report` | Reaper | Conductor | Period completion report |
| `trades` | Reaper | kafka-bigquery-connect (disabled) | Raw trade sink |
| `dlq-bigquery-trades` | kafka-bigquery-connect | — | Dead-letter queue |
| `_connect-configs` | kafka-connect internal | — | |
| `_connect-offsets` | kafka-connect internal | — | |
| `_connect-status` | kafka-connect internal | — | |

## Services Using Kafka

- **harvester-conductor**: NATS + Kafka transport, group `harvest-conductor-group`, client `harvest-conductor-client`
- **harvester-reaper**: transactional producer, group `harvest-reaper-group`, idempotent, per-pod transactional ID (= pod name)

## Related Pages
- [Applications](../entities/applications.md) — conductor and reaper use Kafka
- [Kafka Topics](../contracts/kafka-topics.md) — harvester topic contracts and schemas
- [Kafka BigQuery Connect](../infra/kafka-bigquery-connect.md) — sink connector (currently disabled)
- [Environment / ConfigMaps](../config/environment.md) — kafka-brokers-configmap

---
