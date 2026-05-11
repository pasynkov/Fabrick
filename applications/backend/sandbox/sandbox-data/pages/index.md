---
slug: index
category: overview
title: Project Wiki Index
sources:
  - backend1
  - kustomize
  - repo-a
  - repo-b
related:
  []
---

# Project Wiki Index

Trade data harvesting platform for Binance (crypto) and NASDAQ (equities). Collects raw trades → stages to GCS → loads to BigQuery → runs analytics/forecast pipeline. Deployed on Kubernetes via Kustomize/Helm.

## Overview
- [System Overview](overview.md) — Architecture, data flow, and component map

## Apps
- [Assets Registry](apps/assets-registry.md) — Financial instrument reference data (Asset/Pair/Market/Instrument); serves NATS queries
- [Harvester Conductor](apps/harvester-conductor.md) — Orchestrates harvest jobs, owns Harvest/Period DB state, runs BigQuery forecast pipeline
- [Harvester Reaper](apps/harvester-reaper.md) — Kafka worker: fetches trades per period, uploads to GCS, loads to BigQuery
- [Binance Vision Connector](apps/binance-vision-connector.md) — NATS service: streams Binance spot CSV trades from data.binance.vision (GCS-cached)
- [NASDAQ Cloud Storage Connector](apps/nasdaq-cloud-storage-connector.md) — NATS service: streams NASDAQ CSV trades from pre-staged GCS bucket

## Entities
- [Asset / Pair / Market / Instrument](entities/asset.md) — Core domain model for the financial instrument registry
- [Harvest & Period](entities/harvest.md) — Harvest job lifecycle and day-granularity period tracking
- [Kubernetes Applications](entities/applications.md) — 5 microservice deployments in the `harvester` namespace

## Logic
- [Harvest Flow](logic/harvest-flow.md) — End-to-end orchestration: start → reap → report → BigQuery pipeline
- [Trade Transfer](logic/trade-transfer.md) — Per-period trade fetch, GCS staging, BigQuery load detail
- [Deploy Flow](logic/deploy-flow.md) — deploy.sh: image tagging, kustomize build, kubectl apply
- [Auth Service](logic/auth-service.md) — JWT-based authentication (repo-a)

## Contracts
- [NATS Subjects](contracts/nats-subjects.md) — All NATS request/response subjects across services
- [Kafka Topics](contracts/kafka-topics.md) — Kafka topics for async harvest work distribution
- [API Gateway](contracts/api-gateway.md) — Proxies and JWT validation for protected routes (repo-b)

## Transport
- [NATS](transport/nats.md) — In-cluster NATS cluster (Helm), used by all services
- [Kafka](transport/kafka.md) — External Kafka broker + Kafka UI; used by conductor and reaper
- [BigQuery Pipeline](transport/bigquery-pipeline.md) — Post-ingestion analytics: fillWindows, fillForecasts, fillInstruments

## Config
- [Sentinel Config](config/sentinel-config.md) — Shared NestJS bootstrap library, typed env config, health checks
- [Environment](config/environment.md) — Kubernetes ConfigMaps: Postgres, Kafka brokers, NATS servers, GCP credentials

## Infra
- [Grafana](infra/grafana.md) — Monitoring with BigQuery and Postgres datasources (Helm)
- [Kafka BigQuery Connect](infra/kafka-bigquery-connect.md) — BigQuery sink connector (currently disabled)
