---
slug: logic/deploy-flow
category: logic
title: Deploy Flow
sources:
  - kustomize
related:
  - entities/applications
  - transport/nats
  - infra/grafana
  - config/environment
---

# Deploy Flow

## Overview

Single script `deploy.sh` builds the full kustomize tree and applies to cluster.

## Steps

1. Set `KUBECONFIG=../namico_kubeconfig`
2. For each of 5 services, run `kustomize edit set image` to stamp `$TAG` (default: `v90`) into `base/applications/kustomization.yaml`
3. Run `kustomize build --enable-helm --load-restrictor LoadRestrictionsNone ./base`
4. Pipe output to `kubectl apply -f -`

`--enable-helm` required because NATS and Grafana are Helm chart resources.  
`--load-restrictor LoadRestrictionsNone` required because Helm charts reference files outside their kustomization root.

## Kustomize Resource Tree

```
base/
├── namespace.yaml           # Namespace: harvester
├── configmaps/              # 4 ConfigMaps + gcp-service-account-key generator
├── infra/
│   ├── nats/cluster/        # Helm: nats v1.3.6
│   ├── kafka-ui/            # Deployment + Service + Ingress
│   └── grafana/             # Helm: grafana v10.0.0
│   # kafka-bigquery-connect disabled
└── applications/
    ├── priority-class.low.yaml
    ├── assets/registry/
    ├── binance/vision/
    ├── harvester/conductor/
    ├── harvester/reaper/
    └── nasdaq/cloud-storage/
```

## Updating Image Tags

To deploy a new version:
```zsh
export TAG=v91
./deploy.sh
```

Tags are set on images:
- `pasynkov/namico-assets-registry`
- `pasynkov/namico-binance-vision`
- `pasynkov/namico-harvester-conductor`
- `pasynkov/namico-harvester-reaper`
- `pasynkov/namico-nasdaq-cloud-storage`

## Related Pages
- [Applications](../entities/applications.md) — deployed services with resource specs
- [NATS Cluster](../transport/nats.md) — deployed via Helm
- [Grafana](../infra/grafana.md) — deployed via Helm
- [Environment Config](../config/environment.md) — ConfigMaps applied at deploy time
