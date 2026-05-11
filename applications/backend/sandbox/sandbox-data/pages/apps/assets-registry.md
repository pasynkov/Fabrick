---
slug: apps/assets-registry
category: apps
title: Assets Registry
sources:
  - backend1
  - kustomize
related:
  - entities/asset
  - contracts/nats-subjects
  - config/sentinel-config
  - config/environment
  - entities/applications
---

# Assets Registry

NestJS microservice. Financial instrument reference data store. Serves NATS queries for instruments.

**Path:** `apps/assets/registry`  
**Image:** `pasynkov/namico-assets-registry`  
**Transport:** NATS only  
**Replicas:** 1 (RollingUpdate)

## Responsibilities

- Store and serve `Asset`, `Pair`, `Market`, `Instrument` entities
- Answer NATS queries: get/find instrument(s)
- Seed data via TypeORM migrations (CSV import for Binance pairs, NASDAQ pairs, stablecoins)

## NATS Handlers

| Subject | Handler |
|---------|---------|
| `assets.get-instrument` | `InstrumentsController.getInstrument` |
| `assets.find-instrument` | `InstrumentsController.findInstrument` |
| `assets.find-instruments` | `InstrumentsController.findInstruments` |

`findInstruments` supports streaming: returns `Observable<page>` when `stream=true`, emitting all pages in parallel via `mergeMap`.

## Database

PostgreSQL via TypeORM. Database: `assets_registry`. Migrations in `src/database/migrations/`:
- `1756791670441-init` — create tables
- `1756791786439-btc-usdt-binance-spot` — seed BTC/USDT Binance spot instrument
- `1757077697549-binance-pairs` — bulk import Binance pairs from CSV
- `1757109008044-markets` — seed markets (Binance, NASDAQ)
- `1757109595982-binance-instruments` — create Binance instruments
- `1757335392191-nasdaq-pairs` — bulk import NASDAQ pairs

## Kubernetes Configuration

| Env | Value |
|-----|-------|
| `POSTGRES_DATABASE` | `assets_registry` |
| `NATS_QUEUE` | `assets-registry` |
| `TRANSPORTS` | `nats` |

Resources: 150m/128Mi req → 1150m/256Mi limit  
Health check: `GET /healthy` on port 3000

## Related Pages
- [Asset / Instrument Entities](../entities/asset.md) — domain model served by this app
- [NATS Subjects](../contracts/nats-subjects.md) — subjects handled by this app
- [Sentinel Config](../config/sentinel-config.md) — shared bootstrap library
- [Environment Config](../config/environment.md) — Postgres and NATS ConfigMaps
- [Deployed Applications](../entities/applications.md) — Kubernetes deployment details
