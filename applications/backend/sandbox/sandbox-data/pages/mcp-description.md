---
slug: mcp-description
category: overview
title: MCP Description
sources:
  - backend1
  - kustomize
  - repo-a
  - repo-b
related:
  []
---

# What's in This Wiki

This wiki covers a **trade data harvesting platform** for financial markets (Binance crypto + NASDAQ equities). You can ask about architecture, services, data flows, message contracts, Kubernetes deployment, and configuration.

## Repositories / Apps

- **backend1** — NestJS monorepo containing 5 microservices: assets-registry (instrument metadata), harvester-conductor (orchestration), harvester-reaper (trade fetching/staging), binance-vision-connector (Binance data), nasdaq-cloud-storage-connector (NASDAQ data)
- **kustomize** — Kubernetes deployment manifests (Kustomize + Helm) for the `harvester` namespace, including NATS cluster, Kafka UI, Grafana, and all application deployments
- **repo-a** — Auth service providing JWT-based login (access + refresh tokens)
- **repo-b** — API gateway that proxies requests and validates JWT tokens on protected routes

## Knowledge Available

- **Entities**: Asset, Pair, Market, Instrument domain model; Harvest & Period job lifecycle; Kubernetes deployment specs for all 5 services
- **Business Logic**: End-to-end harvest flow (start → reap → report → BigQuery pipeline); per-period trade transfer (fetch → GCS stage → BigQuery load); Kubernetes deploy script
- **Message Contracts**: 8 NATS subjects across 4 namespaces (`assets.*`, `harvester.*`, `crypto.cex.binance.vision.*`, `stock.nasdaq.cloud-storage.*`); 2 Kafka topics (`harvester.reap`, `harvester.report`)
- **Transport**: In-cluster NATS (Helm, 300MB max payload); external Kafka; BigQuery analytics pipeline (fillWindows, fillForecasts, fillInstruments)
- **Config**: Kubernetes ConfigMaps for Postgres, Kafka, NATS, GCP; Sentinel shared bootstrap library env vars
- **Infra**: Grafana (BigQuery + Postgres datasources); Kafka BigQuery Connect sink (currently disabled)

Ask about specific NATS subjects, Kafka topic schemas, GCS file layouts, BigQuery dataset structure, service resource limits, or the step-by-step harvest orchestration flow.
