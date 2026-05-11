---
slug: entities/harvest
category: entities
title: Harvest & Period Entities
sources:
  - backend1
related:
  - entities/asset
  - logic/harvest-flow
  - apps/harvester-conductor
---

# Harvest & Period Entities

PostgreSQL entities owned by the `harvester/conductor` service. Track the lifecycle of a trade-data collection job.

## Harvest

Table: `harvests`.

```
Harvest {
  id: number
  instrumentId: number     // FK → instruments (no ORM relation, raw id)
  from: number             // unix epoch seconds
  to: number               // unix epoch seconds
  status: HarvestStatus    // new | awaiting | completed | error
  periods: Period[]
  createdAt: Date
  updatedAt: Date
}
```

**Status lifecycle:**
```
new → (periods dispatched to Kafka) → awaiting → (BigQuery count matches) → completed
                                                                          → error (timeout 1h or pipeline fail)
```

`getProperFromTo()` — sorts periods, returns `{from: periods[0].from, to: periods[last].to}`.

## Period

Table: `harvest_periods`. Each period covers one calendar day (generated via SQL `generate_series`).

```
Period {
  id: number
  harvest: Harvest
  from: number           // unix epoch seconds (day start)
  to: number             // unix epoch seconds (day end - 1ms)
  status: HarvestPeriodStatus   // new | completed
  trades: number         // count reported by reaper
}
```

Periods are created in a DB transaction using raw SQL insert from `generate_series`. Only Cex and Exchange venues are supported; Dex throws `BadRequestException`.

## Related Pages
- [Asset / Instrument](../entities/asset.md) — instrumentId references Instrument
- [Harvest Flow](../logic/harvest-flow.md) — full orchestration lifecycle
- [Harvester Conductor](../apps/harvester-conductor.md) — service owning these entities

---
