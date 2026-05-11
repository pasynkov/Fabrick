---
slug: mcp-description
category: overview
title: MCP Description
sources:
  - backend1
  - kustomize
related:
  []
---

# Nami Trade Harvesting Platform — Knowledge Base

This wiki covers a two-repository system: a NestJS microservices monorepo (`backend1`) and its Kubernetes deployment configuration (`kustomize`).

**Repositories:**
- `backend1` — NestJS monorepo with 5 microservices for historical trade data harvesting from Binance and NASDAQ, staging to GCS, loading to BigQuery, and running analytics forecasts
- `kustomize` — Kubernetes manifests (kustomize + Helm) for deploying all services to a GKE `harvester` namespace

**You can find:**
- **App descriptions** for all 5 microservices: assets-registry, harvester-conductor, harvester-reaper, binance-vision-connector, nasdaq-cloud-storage-connector — including responsibilities, NATS handlers, Kafka consumers, and configuration
- **Domain entities**: Asset, Pair, Market, Instrument (financial registry), and Harvest, Period (job tracking) — with full TypeScript/TypeORM schemas
- **Business logic flows**: complete harvest orchestration (start → reap → report → BigQuery pipeline) and per-period trade transfer detail (GCS staging, BigQuery load, archiving)
- **8 NATS subjects** across 4 namespaces (`assets.*`, `harvester.*`, `crypto.cex.binance.vision.*`, `stock.nasdaq.cloud-storage.*`) with request/response schemas
- **2 Kafka topics** (`harvester.reap`, `harvester.report`) with message contracts and transaction semantics
- **BigQuery pipeline**: fillWindows, fillSignals (disabled), fillForecasts, fillInstruments queries and dataset structure
- **Kubernetes deployment specs**: replica counts, resource limits, environment variables, GCS bucket names, Kafka transactional IDs per service
- **Infrastructure**: in-cluster NATS cluster (Helm, 300 MB max payload), external Kafka with Kafka UI, Grafana with BigQuery + Postgres datasources, disabled Kafka BigQuery Connect sink
- **Config**: all environment variables grouped by concern (Postgres, NATS, Kafka, GCP/GCS)

Ask about any service's NATS handlers, the harvest job lifecycle, BigQuery schema, GCS file layout, Kubernetes resource limits, or how to deploy a new image version.

---
