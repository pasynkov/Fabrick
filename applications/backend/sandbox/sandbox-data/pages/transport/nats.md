---
slug: transport/nats
category: transport
title: NATS Cluster
sources:
  - kustomize
related:
  - entities/applications
  - config/environment
  - contracts/nats-subjects
---

# NATS Cluster

In-cluster NATS server deployed via Helm chart `nats` v1.3.6 (nats-io official chart), release name `nats-cluster`.

## Configuration

| Setting | Value |
|---------|-------|
| Image tag | `2.10-alpine` |
| Cluster mode | enabled, 1 replica |
| Cluster name | `nats-cluster` |
| JetStream | disabled (commented out) |
| Max payload | 300 MB |
| Max pending | 320 MB |
| Prometheus exporter | enabled |
| nats-box | enabled |

System account `$SYS` configured with user `sys`/`sys`.

Each pod gets env vars: `POD_NAME`, `SERVER_NAME` (= pod name), `NODE_NAME`, `POD_NAMESPACE`.

## Access

**In-cluster**: `nats://nats-cluster-headless.harvester.svc.cluster.local:4222`

**Local port-forward** (`nats-forward.sh`):
```zsh
kubectl port-forward svc/nats-cluster -n harvester 4222
```

## Queue Names per Service

| Service | NATS_QUEUE |
|---------|-----------|
| assets-registry | `assets-registry` |
| binance-vision | `binance-vision` |
| harvester-conductor | `harvester-conductor` |
| harvester-reaper | `harvester-reaper` |
| nasdaq-cloud-storage | `nasdaq-cloud-storage` |

## Related Pages
- [Applications](../entities/applications.md) — all services subscribe via NATS
- [Environment Config](../config/environment.md) — nats-servers-configmap
- [NATS Subjects](../contracts/nats-subjects.md) — message contracts served over this cluster
