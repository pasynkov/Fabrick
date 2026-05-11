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

# Nami Trade Harvesting Platform — Wiki Index

NestJS monorepo + Kubernetes deployment for historical trade data collection. Ingests Binance (crypto) and NASDAQ (equities) trade data → GCS staging → BigQuery → analytics/forecast pipeline.

## Overview
- [System Overview](overview) — Architecture, data flow, and service map

## Apps
- [Assets Registry](apps/assets-registry) — Financial instrument reference data (Asset/Pair/Market/Instrument); serves NATS queries
- [Harvester Conductor](apps/harvester-conductor) — Orchestrates harvest jobs, owns Harvest/Period DB state, runs BigQuery forecast pipeline
- [Harvester Reaper](apps/harvester-reaper) — Kafka worker: fetches trades per period, uploads to GCS, loads to BigQuery
- [Binance Vision Connector](apps/binance-vision-connector) — NATS service: streams Binance spot CSV trades from data.binance.vision (GCS-cached)
- [NASDAQ Cloud Storage Connector](apps/nasdaq-cloud-storage-connector) — NATS service: streams NASDAQ CSV trades from pre-staged GCS bucket

## Entities
- [Asset / Pair / Market / Instrument](entities/asset) — Core domain model for the financial instrument registry
- [Harvest & Period](entities/harvest) — Harvest job lifecycle and day-granularity period tracking
- [Kubernetes Applications](entities/applications) — 5 microservice deployments in the `harvester` namespace with resource specs

## Logic
- [Harvest Flow](logic/harvest-flow) — End-to-end orchestration: start → reap → report → BigQuery pipeline
- [Trade Transfer](logic/trade-transfer) — Per-period trade fetch, GCS staging, and BigQuery load detail
- [Deploy Flow](logic/deploy-flow) — deploy.sh: image tagging, kustomize build, kubectl apply

## Contracts
- [NATS Subjects](contracts/nats-subjects) — All NATS request/response subjects (8 subjects across 4 namespaces)
- [Kafka Topics](contracts/kafka-topics) — Kafka topics for async harvest work distribution (harvester.reap, harvester.report)

## Transport
- [NATS Cluster](transport/nats) — In-cluster NATS (Helm), used by all services; 300 MB max payload
- [Kafka](transport/kafka) — External Kafka broker + Kafka UI; used by conductor and reaper
- [BigQuery Pipeline](transport/bigquery-pipeline) — Post-ingestion analytics: fillWindows, fillForecasts, fillInstruments

## Config
- [Sentinel Config](config/sentinel-config) — Shared NestJS bootstrap library, typed env config, health checks
- [Environment / ConfigMaps](config/environment) — Kubernetes ConfigMaps: Postgres, Kafka brokers, NATS servers, GCP credentials

## Infra
- [Grafana](infra/grafana) — Monitoring with BigQuery and Postgres datasources (Helm)
- [Kafka BigQuery Connect](infra/kafka-bigquery-connect) — BigQuery sink connector (currently disabled)

---
