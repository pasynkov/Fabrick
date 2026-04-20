## 1. Env Vars: Enriched Schema

- [x] 1.1 Add rule-based type inference: `_SECRET|_KEY|_PASSWORD|_TOKEN` → secret, `_URL|_ENDPOINT|_HOST` → url
- [x] 1.2 Add enum detection: grep for comparisons against env var values (e.g. `=== 'debug'`) → extract possible values
- [x] 1.3 Add `safe_to_share` flag: false for secret type, true for all others
- [x] 1.4 Claude fills `description` for each env var from usage context in code
- [x] 1.5 Update `envs.yaml` output format in SKILL.md

## 2. Endpoints: Schema + Description

- [x] 2.1 NestJS: extract DTO fields from `@Body()`, `@Param()`, `@Query()` decorators
- [x] 2.2 FastAPI: extract Pydantic model fields from route function signature
- [x] 2.3 Spring Boot: extract `@RequestBody` class fields
- [x] 2.4 Claude fills `description` per endpoint from method name + handler logic
- [x] 2.5 Update `endpoints.yaml` output format in SKILL.md

## 3. Integrations: New File

- [x] 3.1 Grep for Kafka patterns: `@KafkaListener`, `kafkajs`, `consumer.subscribe` → extract topic + direction
- [x] 3.2 Grep for NATS patterns: `nats.connect`, `@MessagePattern` with NATS → extract subject + direction
- [x] 3.3 Grep for gRPC patterns: `grpc.loadPackageDefinition`, `.proto` files → extract service names
- [x] 3.4 Grep for WebSocket patterns: `ws.Server`, `socket.io`, `@WebSocketGateway`
- [x] 3.5 Infer external services from imports: pg/typeorm/prisma → postgres; ioredis → redis; mongoose → mongodb; etc.
- [x] 3.6 Write `integrations.yaml` section in SKILL.md

## 4. Remove dependencies.yaml

- [x] 4.1 Remove Phase 1d (dependencies extraction) from SKILL.md
- [x] 4.2 Remove `dependencies.yaml` from output checklist

## 5. Domain: New File

- [x] 5.1 Add domain.md to Claude analysis phase: extract entities from ORM models, DTOs, type definitions
- [x] 5.2 Extract business rules: constants, config thresholds, validation constraints with business meaning
- [x] 5.3 Extract key flows: end-to-end business operations (not technical steps)
- [x] 5.4 Write `domain.md` section in SKILL.md

## 6. Polyglot Detection

- [x] 6.1 Add Java detection: `pom.xml` / `build.gradle` → spring-boot, quarkus, micronaut
- [x] 6.2 Add .NET detection: `*.csproj` → ASP.NET, Minimal API
- [x] 6.3 Add DevOps detection: `*.tf` → terraform, `Chart.yaml` → helm, `kustomization.yaml` → kustomize, `Application.yaml` → argocd
- [x] 6.4 For DevOps repos: skip endpoints/envs, extract infra resources instead, write infra-specific integrations.yaml
- [x] 6.5 Update meta.yaml format: add `type: application|infrastructure`
- [x] 6.6 Update Phase 1a in SKILL.md with new manifest checks

## 7. Monorepo Support

- [x] 7.1 Add monorepo detection: check nx.json, turbo.json, lerna.json, go.work, multi-manifest apps/ or packages/
- [x] 7.2 If monorepo: enumerate apps, run full per-app analysis for each, write to `apps/<name>/`
- [x] 7.3 Add cross-app pass: grep inter-package imports, match shared Kafka/NATS topics across apps
- [x] 7.4 Write `cross-app.yaml`: communications + shared_packages
- [x] 7.5 Write monorepo section in SKILL.md: detection logic + output structure

## 8. Verification

- [x] 8.1 Run updated skill on NestJS repo — verify enriched envs, endpoint schemas, integrations.yaml, domain.md
- [x] 8.2 Run on Python/FastAPI repo — verify polyglot detection + endpoint schema extraction
- [x] 8.3 Run on monorepo (e.g. Nx workspace) — verify per-app structure + cross-app.yaml
- [x] 8.4 Confirm no `dependencies.yaml` produced
- [x] 8.5 Confirm no env values in output
