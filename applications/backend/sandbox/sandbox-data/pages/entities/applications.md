---
slug: entities/applications
category: entities
title: Kubernetes Application Deployments
sources:
  - kustomize
related:
  - config/environment
  - transport/nats
  - transport/kafka
  - infra/grafana
  - logic/deploy-flow
---

# Kubernetes Application Deployments

Five microservices deployed to the `harvester` namespace. All use `default-low` PriorityClass. Health check endpoint: `GET /healthy` on port 3000.

## assets-registry

**Image**: `pasynkov/namico-assets-registry`  
**Replicas**: 1 | **Strategy**: RollingUpdate

Stores and serves financial instrument asset metadata. Uses Postgres (`assets_registry` DB) + NATS transport only.

| Env | Value |
|-----|-------|
| `POSTGRES_DATABASE` | `assets_registry` |
| `NATS_QUEUE` | `assets-registry` |
| `TRANSPORTS` | `nats` |

Resources: 150m/128Mi req → 1150m/256Gi limit

## binance-vision

**Image**: `pasynkov/namico-binance-vision`  
**Replicas**: 4 | **Strategy**: RollingUpdate (maxUnavailable: 2, maxSurge: 1)

Downloads historical trade data from Binance Vision and stores to GCS bucket `binance_vision`. NATS only.

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `binance-vision` |
| `TRANSPORTS` | `nats` |
| `BINANCE_VISION_STORAGE_GCP_BUCKET_NAME` | `binance_vision` |

Resources: 250m/512Mi req → 1150m/1Gi limit. Mounts GCP key at `/etc/secrets/key.json`.

## harvester-conductor

**Image**: `pasynkov/namico-harvester-conductor`  
**Replicas**: 1 | **Strategy**: Recreate

Orchestrates harvest jobs. Receives commands via NATS, publishes to Kafka, persists job state in Postgres (`harvester` DB). Also writes to GCP (BigQuery).

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `harvester-conductor` |
| `TRANSPORTS` | `nats,kafka` |
| `KAFKA_CLIENT_ID` | `harvest-conductor-client` |
| `KAFKA_GROUP_ID` | `harvest-conductor-group` |

Resources: 125m/256Mi req → 1150m/512Gi limit. Mounts GCP key at `/etc/secrets/key.json`.

## harvester-reaper

**Image**: `pasynkov/namico-harvester-reaper`  
**Replicas**: 4 | **Strategy**: Recreate

Batch-processes raw trade records. Reads from Kafka (`harvester.reap`), fetches trades via NATS, writes JSONL to GCS bucket `trades_jsonl`, loads to BigQuery. Uses Kafka transactions (transactional ID from pod name for uniqueness per replica).

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `harvester-reaper` |
| `TRANSPORTS` | `nats,kafka` |
| `KAFKA_TRANSACTIONAL_ID` | `metadata.name` (pod name) |
| `KAFKA_IDEMPOTENT` | `true` |
| `REAPER_NATS_BATCH_SIZE` | `10000` |
| `REAPER_KAFKA_BATCH_SIZE` | `7000` |
| `REAPER_KAFKA_PARALLEL_WRITES` | `10` |
| `REAPER_GCP_BUCKET_NAME` | `trades_jsonl` |

Resources: 250m/1Gi req → 1150m/2Gi limit.

## nasdaq-cloud-storage

**Image**: `pasynkov/namico-nasdaq-cloud-storage`  
**Replicas**: 4 | **Strategy**: RollingUpdate (maxUnavailable: 0, maxSurge: 1)

Stores NASDAQ trade data to GCS bucket `nasdaq-trades`. NATS only.

| Env | Value |
|-----|-------|
| `NATS_QUEUE` | `nasdaq-cloud-storage` |
| `TRANSPORTS` | `nats` |
| `NASDAQ_CLOUD_STORAGE_GCP_BUCKET_NAME` | `nasdaq-trades` |

Mounts GCP key at `/etc/secrets/key.json`.

## Image Versioning

All images tagged via `kustomize edit set image` in `base/applications/kustomization.yaml`. Current deploy tag: `v90` (variable `$TAG` in `deploy.sh`).

## Related Pages
- [Environment Config](../config/environment.md) — ConfigMaps injected into all pods
- [NATS Cluster](../transport/nats.md) — message bus used by all services
- [Kafka](../transport/kafka.md) — used by conductor and reaper
- [Grafana](../infra/grafana.md) — monitoring with BigQuery + Postgres datasources
- [Deploy Flow](../logic/deploy-flow.md) — how images are tagged and deployed

---
