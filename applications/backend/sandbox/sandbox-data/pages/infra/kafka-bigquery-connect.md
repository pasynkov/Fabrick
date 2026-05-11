---
slug: infra/kafka-bigquery-connect
category: infra
title: Kafka BigQuery Connect
sources:
  - kustomize
related:
  - transport/kafka
  - config/environment
  - contracts/kafka-topics
---

# Kafka BigQuery Connect

**Status: disabled** — commented out in `base/infra/kustomization.yaml`.

Kafka Connect worker that sinks the `trades` Kafka topic to BigQuery using the `BigQuerySinkConnector` (zetaab/wepay plugin).

## Deployment

- **Image**: `pasynkov/namico-kafka-connect-bigquery:latest`
- **Replicas**: 1 | **Strategy**: Recreate
- **Priority**: custom `kafka-bigquery-connect-priority` class
- **Resources**: 1 CPU/2Gi req → 2 CPU/4Gi limit
- **REST API**: port 8083 (health at `/connectors`)
- Mounts GCP key at `/etc/kafka-connect/secrets/key.json`

## Connector Config (`config/config.json`)

| Setting | Value |
|---------|-------|
| Connector class | `com.wepay.kafka.connect.bigquery.BigQuerySinkConnector` |
| Tasks | 12 |
| Topics | `trades` |
| GCP Project | `cs-poc-xyd1uouxnw27ehczhe6rxby` |
| Dataset | `trades_raw` |
| Auto-create tables | yes |
| GCS staging bucket | `nami-bq-staging` |
| Batch load interval | 60s |
| Max poll records | 30000 |
| Dead-letter topic | `dlq-bigquery-trades` |
| Error tolerance | all |
| Null value behavior | IGNORE |

Batch load mode enabled via GCS intermediate staging (`enableBatchLoad: trades`).

## Re-enabling

Uncomment `- kafka-bigquery-connect` in `base/infra/kustomization.yaml` and apply connector config via REST after pod starts:
```bash
curl -X POST http://<pod>:8083/connectors -H 'Content-Type: application/json' -d @config/config.json
```

## Related Pages
- [Kafka](../transport/kafka.md) — source topic `trades`
- [Kafka Topics](../contracts/kafka-topics.md) — `trades` and `dlq-bigquery-trades` topic definitions
- [Environment Config](../config/environment.md) — kafka-brokers-configmap, GCP key
