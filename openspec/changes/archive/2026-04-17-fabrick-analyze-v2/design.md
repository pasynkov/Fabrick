## Context

Claude Code skill running inside developer's repo. Full filesystem read access, Bash commands available. All analysis is local — no source code leaves the machine.

Extends `fabrick-analyze` (v1). All existing phases retained; this change enriches output schema and adds new extraction phases.

## Goals / Non-Goals

**Goals:**
- Enrich envs.yaml: type, description, safe_to_share flag, enum values
- Enrich endpoints.yaml: description, request/response schema
- Add integrations.yaml: non-HTTP integrations (Kafka, NATS, gRPC, WebSocket) + external services
- Remove dependencies.yaml
- Add domain.md: entities, business rules, key business flows
- Expand framework detection: Java, .NET, DevOps tooling
- Monorepo detection + per-app output structure

**Non-Goals:**
- Env variable values (never extracted)
- Full OpenAPI spec generation (schema is best-effort, not complete)
- Dynamic analysis (only static code reading)
- Multi-language in same app (detect primary language only)

## Decisions

### envs.yaml enrichment strategy

Rule-based typing first, Claude fills description:
- Name ends in `_URL`, `_ENDPOINT`, `_HOST` → `type: url`, `safe_to_share: true`
- Name ends in `_SECRET`, `_KEY`, `_PASSWORD`, `_TOKEN` → `type: secret`, `safe_to_share: false`
- Code checks value against string literals (e.g. `=== 'debug'`) → `type: enum`, extract values from comparisons
- Else → `type: string`, Claude infers description

### endpoints.yaml schema extraction

Per framework:
- **NestJS**: read DTO classes referenced in `@Body()`, `@Param()`, `@Query()` decorators → extract fields
- **FastAPI**: read Pydantic models in route function signature → extract fields
- **Spring Boot**: read `@RequestBody` class fields → extract fields
- **Go (gin/echo)**: best-effort — look for struct binding
- **All**: Claude fills `description` from method name + handler logic

### integrations.yaml sources

Two passes:
1. **Pattern grep** (rule-based): `@KafkaListener`, `kafkajs`, `nats.connect`, `grpc.loadPackageDefinition`, `ws.Server`, etc.
2. **Dependency inference**: if `pg`/`typeorm`/`prisma` in imports → postgres; `ioredis`/`redis` → redis; etc.

No overlap with endpoints.yaml — HTTP stays in endpoints.yaml, everything else in integrations.yaml.

### domain.md extraction

Claude analysis phase only (not rule-based):
- Entities: from ORM models, DTOs, database schemas, type definitions
- Business rules: constants with business meaning, validation constraints, config thresholds
- Key flows: same logic.md approach but focused on business semantics, not technical steps

### Monorepo detection

Check in order:
1. `nx.json` or `turbo.json` or `lerna.json` → monorepo confirmed
2. `go.work` → Go monorepo confirmed
3. `apps/` or `packages/` directory with 2+ subdirectories each containing own manifest → likely monorepo
4. Java `pom.xml` with `<modules>` block → multi-module

If monorepo: run full per-app analysis for each detected app, then run cross-app pass.

### cross-app.yaml extraction

After all per-app analyses:
- Grep for inter-package imports (e.g. `@myorg/payments` imported in `@myorg/web`)
- Match NATS subjects / Kafka topics that appear in multiple apps (publisher in one, consumer in another)
- List shared packages used by 2+ apps

### Output structure

Single app (unchanged):
```
.fabrick/context/
  meta.yaml
  endpoints.yaml
  envs.yaml
  integrations.yaml
  overview.md
  logic.md
  domain.md
```

Monorepo:
```
.fabrick/context/
  meta.yaml              # monorepo: true, apps: [...]
  cross-app.yaml
  apps/
    <app-name>/
      meta.yaml
      endpoints.yaml
      envs.yaml
      integrations.yaml
      overview.md
      logic.md
      domain.md
```

### Removed: dependencies.yaml

Tech noise. External service dependencies now captured in integrations.yaml with `role` field. No replacement for package list — not business context.

### DevOps repo handling

If `type: infrastructure` detected in meta.yaml:
- Skip endpoints/envs extraction
- Extract: resources (terraform), chart metadata (helm), destination clusters (argocd)
- Write to integrations.yaml with infrastructure-specific types
- overview.md describes what infra this repo manages

## Risks / Trade-offs

- Schema extraction is best-effort — complex generics or dynamic typing may produce incomplete schemas. Acceptable for PoC.
- Monorepo cross-app pass may miss inter-service HTTP calls if base URLs are dynamic. Kafka/NATS topic matching is more reliable.
- Domain extraction quality depends on code discipline — poorly named entities produce weak domain.md.
