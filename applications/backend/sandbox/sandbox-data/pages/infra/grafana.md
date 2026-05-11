---
slug: infra/grafana
category: infra
title: Grafana
sources:
  - kustomize
related:
  - entities/applications
  - config/environment
---

# Grafana

Deployed via Helm chart `grafana` v10.0.0 (official Grafana chart).

## Configuration

| Setting | Value |
|---------|-------|
| Admin user | `admin` |
| Service type | NodePort (port 80) |
| Ingress | `grafana.internal.namico.io` (GCE internal, HTTP) |
| Persistence | 10Gi PVC, `standard` storage class |
| Resources | 250m/512Mi req → 500m/1Gi limit |
| Strategy | Recreate |

## Datasources

### BigQuery
- Plugin: `grafana-bigquery-datasource`
- Auth: JWT (`bq-sink-sa@cs-poc-xyd1uouxnw27ehczhe6rxby.iam.gserviceaccount.com`)
- Project: `cs-poc-xyd1uouxnw27ehczhe6rxby`
- Default dataset: `trades_raw`
- Private key stored in `values.yaml` `secureJsonData`

### Assets (Postgres)
- Host: `postgres.internal.namico.io:5432`
- Database: `assets_registry`
- User: `postgres`

## Plugins

- `grafana-bigquery-datasource`

## Related Pages
- [Applications](../entities/applications.md) — services whose data appears in dashboards
- [Environment Config](../config/environment.md) — Postgres credentials (same as configmap)

---
