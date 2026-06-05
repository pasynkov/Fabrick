# Kustomize / Helm framework hint

YAML-only GitOps repo. No decorators, no imports — routing is driven entirely by Kubernetes resource kinds and file paths.

## Slug → kustomize symbol kinds

The YAML extractor emits `kind` per document. Map directly:

| kind            | Slug(s)                    |
|-----------------|----------------------------|
| `Deployment`    | service, config            |
| `StatefulSet`   | service, config            |
| `DaemonSet`     | service, config            |
| `Job`           | service                    |
| `CronJob`       | service                    |
| `Pod`           | service                    |
| `Service`       | contracts                  |
| `Ingress`       | contracts                  |
| `Route`         | contracts (OpenShift)      |
| `HTTPRoute`     | contracts (Gateway API)    |
| `ConfigMap`     | config (plus integrations if name references an external system) |
| `Secret`        | config                     |
| `ServiceAccount`| service                    |
| `Role` / `RoleBinding` / `ClusterRole` / `ClusterRoleBinding` | service |
| `PriorityClass` | service                    |
| `Namespace`     | service                    |
| `Kustomization` | service (composition)      |

## Slug → file patterns

| Pattern                               | Slug(s)                |
|---------------------------------------|------------------------|
| `**/deployment.yaml`                  | service, config        |
| `**/statefulset.yaml`                 | service, config        |
| `**/service.yaml`                     | contracts              |
| `**/ingress.yaml`                     | contracts              |
| `**/configmap.yaml`                   | config                 |
| `**/secret.yaml`                      | config                 |
| `**/kustomization.yaml`               | service                |
| `**/namespace.yaml`                   | service                |
| `**/priority-class*.yaml`             | service                |
| `**/Chart.yaml`                       | integrations           |
| `**/values.yaml`                      | config, integrations   |
| `**/templates/**`                     | (skip — helm template) |
| `**/charts/**`                        | integrations (vendored) |

## ConfigMap naming heuristic

ConfigMap names that match external-system names indicate integrations (cluster-level identity of an external service). Examples:
- `kafka-brokers.configmap.yaml` → integrations (Kafka cluster connection)
- `nats-servers.configmap.yaml` → integrations (NATS cluster)
- `postgres.configmap.yaml` → integrations (PostgreSQL)
- `redis.configmap.yaml` → integrations (Redis)
- `gcp-service-account.configmap.yaml` → integrations (GCP credentials)

These ConfigMaps are dual-purpose: they ARE config from a workload's perspective AND they identify which external systems exist in the cluster.

## Directory conventions

| Directory          | Meaning                                       |
|--------------------|-----------------------------------------------|
| `base/`            | Kustomize base layer (canonical resources)    |
| `overlays/<env>/`  | Per-environment overlays (prod, staging, dev) |
| `base/applications/`| Per-microservice workloads                   |
| `base/infra/`      | Third-party infrastructure (Helm sub-charts)  |
| `base/configmaps/` | Shared ConfigMaps for the whole cluster       |

`base/infra/` always routes to integrations regardless of resource kind — it represents installed external systems.

## Gotchas

- Vendored Helm chart subtrees (`charts/<name>-<version>/`) generate hundreds of YAML files for one logical integration — collapse to one entry per chart.
- `kustomization.yaml` in a leaf directory composes that directory's resources; it does not itself document an external interface — service-only.
- `values.yaml` inside a Helm chart often holds both config (image tag, replicas) AND external integration parameters (DSNs, brokers).
- `__generated__/` and `dist/` directories must be skipped.
