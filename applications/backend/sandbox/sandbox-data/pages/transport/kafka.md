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

## Services Using Kafka

| Service | Role | Group ID | Notes |
|---------|------|----------|-------|
| harvester-conductor | producer + consumer | `harvest-conductor-group` | Publishes `harvester.reap`, consumes `harvester.report` |
| harvester-reaper | consumer + producer | `harvest-reaper-group` | Transactional, idempotent, per-pod transactional ID |

## Related Pages
- [Kafka Topics](../contracts/kafka-topics.md) — topic definitions and schemas
- [Applications](../entities/applications.md) — conductor and reaper deployment specs
- [Kafka BigQuery Connect](../infra/kafka-bigquery-connect.md) — sink connector (currently disabled)
- [Environment Config](../config/environment.md) — kafka-brokers-configmap
