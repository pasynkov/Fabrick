---
slug: index
category: overview
title: Project Wiki Index
sources:
  - backend1
  - kustomize
related:
  []
---

# Nami Project Wiki

NestJS monorepo + Kubernetes deployment for a trade data harvesting pipeline. Collects raw trades from Binance (crypto) and NASDAQ (equities) → stages to Google Cloud Storage → loads to BigQuery → runs analytics/forecast pipeline.

## Overview
- [System Overview](overview.md) — Architecture, data flow, and service map

## Apps
- [Assets Registry](apps/assets-registry.md) — Financial instrument reference data (Asset/Pair/Market/Instrument); serves NATS queries
- [Harvester Conductor](apps/harvester-conductor.md) — Orchestrates harvest jobs, owns Harvest/Period DB state, runs BigQuery forecast pipeline
- [Harvester Reaper](apps/harvester-reaper.md) — Kafka worker: fetches trades per period, uploads to GCS, loads to BigQuery
- [Binance Vision Connector](apps/binance-vision-connector.md) — NATS service: streams Binance spot CSV trades from data.binance.vision (GCS-cached)
- [NASDAQ Cloud Storage Connector](apps/nasdaq-cloud-storage-connector.md) — NATS service: streams NASDAQ CSV trades from pre-staged GCS bucket

## Entities
- [Asset / Pair / Market / Instrument](entities/asset.md) — Core domain model for the financial instrument registry
- [Harvest & Period](entities/harvest.md) — Harvest job lifecycle and day-granularity period tracking
- [Deployed Applications](entities/applications.md) — Kubernetes deployment specs for all 5 microservices

## Logic
- [Harvest Flow](logic/harvest-flow.md) — End-to-end orchestration: start → reap → report → BigQuery pipeline
- [Trade Transfer](logic/trade-transfer.md) — Per-period trade fetch, GCS staging, BigQuery load detail
- [Deploy Flow](logic/deploy-flow.md) — deploy.sh: image tagging, kustomize build, kubectl apply

## Contracts
- [NATS Subjects](contracts/nats-subjects.md) — All NATS request/response subjects across services (8 subjects)
- [Kafka Topics](contracts/kafka-topics.md) — Kafka topics for async harvest work distribution (2 topics)

## Transport
- [NATS Cluster](transport/nats.md) — In-cluster NATS (Helm), used by all 5 services
- [Kafka](transport/kafka.md) — External Kafka broker + Kafka UI; used by conductor and reaper
- [BigQuery Pipeline](transport/bigquery-pipeline.md) — Post-ingestion analytics: fillWindows, fillForecasts, fillInstruments

## Config
- [Sentinel Config](config/sentinel-config.md) — Shared NestJS bootstrap library, typed env config, health checks
- [Environment / ConfigMaps](config/environment.md) — Kubernetes ConfigMaps: Postgres, Kafka brokers, NATS servers, GCP credentials

## Infra
- [Grafana](infra/grafana.md) — Monitoring with BigQuery and Postgres datasources (Helm)
- [Kafka BigQuery Connect](infra/kafka-bigquery-connect.md) — BigQuery sink connector (currently disabled)
