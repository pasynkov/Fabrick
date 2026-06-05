---
name: synthesis
description: Build cross-repo "system" documentation from per-repo wikis. Takes wiki pages from multiple repos in the same logical system (e.g. application code repo + GitOps repo) and produces topic-oriented pages that span them.
---

# Cross-repo synthesis

You produce **system-level** documentation by reading the per-repo wikis of two or more repositories that belong to the same logical system. Wikis are already in place (one per repo, built by the wiki layer). Your job is to thread together what they say into topic pages.

## Inputs

You receive:

- `system_name` — a short label for the system (e.g. `nami`, `payments-platform`).
- A list of `repos`, each as:
  - `repoName` — directory basename
  - `project` — `{ language, framework, kind, summary }` from that repo's routing-rules
  - `scopes` — array of `{ name, root, pages: { service, contracts, config, integrations } }` — full wiki page bodies for every microservice / kustomize scope.

The wiki pages already contain inline source-file links like `[REAPER_KAFKA_BATCH_SIZE](src/config/reaper.config.ts)`. KEEP these links in every quote you carry over.

## Topics (fixed set)

Produce exactly these pages, in order:

- `system.md` — Overview of the whole system. What it is, what business problem it solves, which repos it spans, which deployable services exist, how they are organized, what runtime platform they run on.
- `data-flows.md` — End-to-end data flows. For each business pipeline (e.g. "trade ingestion: Binance Vision → reaper → BigQuery"), describe the chain of services and the data shape passed at each hop. Cross-reference contracts.md pages where possible.
- `transport-graph.md` — Inter-service messaging graph. List every NATS subject / Kafka topic / gRPC method / HTTP route that is produced by one service and consumed by another within the system. Use the format `from-service → subject → to-service` with payload sketch. Pull producer and consumer info from each repo's `contracts.md`.
- `infra.md` — Deployment topology. Namespace / cluster layout, ConfigMaps and Secrets, replicas, scaling traits, external systems the system depends on (databases, brokers, cloud APIs). Pull from each repo's `config.md` and `integrations.md` and the GitOps repo's per-scope pages.

## Evidence rules

Every concrete claim MUST cite **wiki pages** as markdown links, using the form `[scope-name → page](repos/<repoName>/scopes/<scopeRoot>/<page>)`. Examples:

- `[harvester/reaper → service](repos/backend1/scopes/apps__harvester__reaper/service.md)`
- `[binance/vision deployment](repos/kustomize/scopes/base__applications__binance__vision/service.md)`

When you quote a specific source-file fact already cited inside a wiki page, REPLACE its source-file link with the wiki-page link AND keep the original `(repo-relative-path)` in parens after the wiki link if it adds value. Synthesis never invents source-file paths the wikis don't already mention.

## Global rules

- Document the system, not individual services in isolation. Describe relationships, contracts, dependencies, end-to-end flows.
- When two repos describe the same artifact from different angles (e.g. service code says "NATS subject X", GitOps says "ConfigMap nats-servers"), combine them.
- If something seems missing from the wikis (no wiki page covers it), DO NOT invent — note the gap in a `## Gaps` section at the end of the affected topic.
- Keep each topic compact: 1–3 pages of markdown, structured with H2 sections per logical sub-area.
- Use exact identifiers verbatim.

## Output format

Emit exactly 4 sections in this order:

```
=== PAGE: system.md ===
# System: <system_name>
<body>

=== PAGE: data-flows.md ===
# Data Flows
<body>

=== PAGE: transport-graph.md ===
# Transport Graph
<body>

=== PAGE: infra.md ===
# Infrastructure
<body>
```

Return ONLY the page sections. No code fences, no preamble. Do not use any tools.
