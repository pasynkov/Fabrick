---
slug: entities/asset
category: entities
title: Asset / Pair / Market / Instrument Entities
sources:
  - backend1
related:
  - entities/harvest
  - contracts/nats-subjects
  - apps/assets-registry
---

# Asset / Pair / Market / Instrument Entities

Core domain model for the financial asset registry. Four entities form the hierarchy used across all services.

## Asset

Table: `assets`. PK: `symbol` (varchar).

```
Asset {
  symbol: string       // BTC, ETH, AAPL, USD
  name: string         // Bitcoin, Apple, US Dollar
  class: AssetClass    // crypto | fiat | stablecoin
  metadata?: {
    decimals?: number
    contractAddress?: string   // ERC-20 tokens
    chain?: string             // ethereum, solana
    isoCode?: string           // USD, EUR (fiat/FX)
    isin?: string              // equities
    cusip?: string             // equities (alt to ISIN)
    country?: string
    [key: string]: any
  }
}
```

## Pair

Table: `pairs`. PK: `symbol` (varchar). Unique on `(base, quote)`.

```
Pair {
  symbol: string    // BTCUSDT, AAPL/USD
  base: Asset       // FK → assets
  quote: Asset      // FK → assets
  instruments?: Instrument[]
}
```

## Market

Table: `markets`. PK: auto-increment `id`.

```
Market {
  id: number
  name: string      // Binance, NASDAQ, Uniswap v3
  venue: Venue      // cex | dex | exchange
  segment?: string  // spot, futures, options
  metadata?: Record<string, any>
  instruments?: Instrument[]
}
```

## Instrument

Table: `instruments`. Unique index on `(market_id, pair)`.

```
Instrument {
  id: number
  pair: Pair       // eager loaded
  market: Market   // eager loaded
  type: InstrumentType  // spot | future
  metadata?: Record<string, any>
}
```

`instrument_key` — computed string used in BigQuery: `{market.name}.{type}.{pair.symbol}` (e.g. `Binance.spot.BTCUSDT`).

## Related Pages
- [Harvest & Period](../entities/harvest.md) — Harvest references instrumentId
- [NATS Subjects](../contracts/nats-subjects.md) — Assets subjects expose Instrument queries
- [Assets Registry App](../apps/assets-registry.md) — service hosting these entities
