## Why

`fabrick-analyze` v2 is a 469-line monolith: one model, one file, one pass. It can't cheaply scan large repos (Sonnet per file is expensive), misses non-standard endpoint patterns (custom decorators, GraphQL, API client wrappers), and produces two overlapping files (`endpoints.yaml` + `integrations.yaml`) that make synthesis harder.

v3 splits into a multi-agent architecture, introduces `connection_points.yaml` as the single source of truth for service integration contracts, and adds a `patterns.md` that grows through the improvement loop.

## What Changes

- Split `SKILL.md` into: orchestrator (`SKILL.md`), `scanner.md` (Haiku), `synthesis.md` (Sonnet)
- Add `patterns.md` — loop-grown pattern library, read by scanner before each run
- Replace `endpoints.yaml` + `integrations.yaml` with `connection_points.yaml`
- Scanner adds semantic tracing for custom decorators and outgoing HTTP abstractions
- Messaging integrations (Kafka/NATS/gRPC) get `schema` field — treated as endpoints
- Frontend apps capture outgoing calls in `connection_points.outbound`

## Capabilities

### Modified Capabilities

- `fabrick-analyze`: Multi-agent execution, richer integration contracts, synthesis-ready output

## Output Schema Changes

### connection_points.yaml (replaces endpoints.yaml + integrations.yaml)
```yaml
connection_points:
  inbound:
    - type: http
      method: POST
      path: /purchase
      description: Accept card payment request
      schema:
        request: { currency: string, amount: number }
        response: { status: string }
      file: src/app.controller.ts

    - type: kafka
      topic: harvester.reap
      direction: consumer
      description: Trigger harvest of one Period
      schema:
        message: { instrumentId: number, from: number, to: number }
      file: src/reap/reap.controller.ts

  outbound:
    - type: http
      target: libernetix-api
      target_env: LIBERNETIX_API_URL
      method: POST
      path: /purchases/
      description: Create purchase session on Libernetix
      schema:
        request: { email: string, products: array, currency: string }

    - type: http
      target_env: REACT_APP_API_URL
      method: POST
      path: /purchase
      description: Submit payment from frontend
      status: resolved   # or "unresolved" if trace failed
```

### Removed
- `endpoints.yaml`
- `integrations.yaml`

### Skill file structure
```
.claude/skills/fabrick-analyze/
  SKILL.md        # orchestrator — coordinates agents, ~50 lines
  scanner.md      # Haiku instructions — semantic scan → raw extraction
  synthesis.md    # Sonnet instructions — raw + code → narrative files
  patterns.md     # loop-grown patterns, empty initially
```

## Impact

- Modified: `.claude/skills/fabrick-analyze/SKILL.md` (shrinks to orchestrator)
- New: `.claude/skills/fabrick-analyze/scanner.md`
- New: `.claude/skills/fabrick-analyze/synthesis.md`
- New: `.claude/skills/fabrick-analyze/patterns.md`
- Output schema change: `connection_points.yaml` replaces `endpoints.yaml` + `integrations.yaml`
- Downstream: `fabrick-synthesis` and `fabrick-push` need to handle new schema
- Prerequisite: none (extends v2 in-place)
