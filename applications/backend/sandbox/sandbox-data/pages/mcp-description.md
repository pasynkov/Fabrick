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

# What's in This Wiki

This wiki covers the **Nami trade data harvesting system** — a NestJS monorepo (`backend1`) and its Kubernetes deployment configuration (`kustomize`). You can find detailed documentation on all microservices, their messaging contracts, domain entities, business logic flows, infrastructure setup, and deployment procedures.

## Repositories / Apps

- **backend1** — NestJS monorepo with 5 microservices: Assets Registry (instrument reference data), Harvester Conductor (job orchestration), Harvester Reaper (trade ingestion worker), Binance Vision Connector (Binance trade data source), NASDAQ Cloud Storage Connector (NASDAQ trade data source)
- **kustomize** — Kubernetes manifests (kustomize + Helm) for deploying all services to a `harvester` namespace, plus infrastructure (NATS cluster, Kafka UI, Grafana)

## Knowledge Available

**Entities**: Ask about `Asset`, `Pair`, `Market`, `Instrument`, `Harvest`, `Period` domain models and their PostgreSQL schemas.

**Endpoints / Contracts**: 8 NATS subjects (assets queries, harvest control, trade streaming) and 2 Kafka topics (`harvester.reap`, `harvester.report`) with full request/response schemas.

**Business Flows**: Full harvest lifecycle (start → reap → GCS stage → BigQuery load → forecast pipeline), per-period trade transfer logic, GCS file layout, BigQuery completion check.

**Transport**: In-cluster NATS cluster config, external Kafka broker topology, BigQuery analytics pipeline (fillWindows, fillForecasts, fillInstruments queries).

**Config**: All environment variables per service, Kubernetes ConfigMaps (Postgres, Kafka, NATS, GCP), Sentinel bootstrap library options.

**Infra**: Grafana (BigQuery + Postgres datasources), Kafka UI, disabled Kafka BigQuery Connect sink, deploy script and kustomize resource tree.
