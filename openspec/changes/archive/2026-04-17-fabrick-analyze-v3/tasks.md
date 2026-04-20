## 1. Orchestrator: Rewrite SKILL.md

- [x] 1.1 Shrink SKILL.md to orchestrator role: setup, monorepo detection, write scanner-task.md, invoke Haiku scanner, read raw-extraction.yaml, hand off to synthesis
- [x] 1.2 Add tmp file protocol: write `.fabrick/tmp/scanner-task.md` with repo path + app dir + patterns.md content
- [x] 1.3 Add Haiku invocation: `claude -p "$(cat .fabrick/tmp/scanner-task.md)" --model claude-haiku-4-5-20251001`
- [x] 1.4 Add tmp cleanup step after successful run
- [x] 1.5 Update output checklist: replace endpoints.yaml + integrations.yaml with connection_points.yaml

## 2. Scanner: Write scanner.md (Haiku)

- [x] 2.1 Write Phase 1: framework/language detection from manifests → meta.yaml fields
- [x] 2.2 Write Phase 2: read patterns.md, apply known patterns before standard discovery
- [x] 2.3 Write Phase 3: semantic endpoint discovery
  - 2.3a HTTP — find candidate files (grep), read each, trace unknown decorators depth-1
  - 2.3b Kafka — grep consumer patterns, extract topic + schema hint
  - 2.3c NATS — grep subscriber patterns, extract subject + schema hint, look for contract files
  - 2.3d gRPC — find .proto files, extract service + method names
  - 2.3e WebSocket/RabbitMQ — grep patterns, extract what's findable
- [x] 2.4 Write Phase 4: outgoing call discovery
  - 2.4a Direct: grep fetch/axios/HttpService/requests.get patterns
  - 2.4b Abstraction: if abstraction found, trace to definition (depth 2 max)
  - 2.4c Fallback: record unresolved with hint if depth exceeded
- [x] 2.5 Write Phase 5: env var extraction + rule-based typing (moved from SKILL.md)
- [x] 2.6 Write Phase 6: external service inference from imports/deps
- [x] 2.7 Define raw-extraction.yaml output format (all scanner findings, no descriptions yet)

## 3. Synthesis: Write synthesis.md (Sonnet)

- [x] 3.1 Write Phase 1: read raw-extraction.yaml, collect key source files (entry points, handlers, DTOs, models)
- [x] 3.2 Write Phase 2: enrich connection_points — read DTOs/contracts/Pydantic models → fill schemas, write descriptions
- [x] 3.3 Write Phase 3: enrich envs.yaml — read usage context → write descriptions
- [x] 3.4 Write Phase 4: write overview.md (moved from SKILL.md Phase 2d)
- [x] 3.5 Write Phase 5: write logic.md (moved from SKILL.md Phase 2e)
- [x] 3.6 Write Phase 6: write domain.md (moved from SKILL.md Phase 2f)
- [x] 3.7 Write Phase 7: write final connection_points.yaml from enriched raw-extraction

## 4. patterns.md: Create empty file

- [x] 4.1 Create `.claude/skills/fabrick-analyze/patterns.md` with header comment explaining format and loop-growth intent
- [x] 4.2 Document pattern entry format in the file itself

## 5. connection_points.yaml: Schema finalization

- [x] 5.1 Document complete connection_points.yaml schema in scanner.md and synthesis.md with examples for each type (http, kafka, nats, grpc, websocket, graphql-*)
- [x] 5.2 Ensure `status: resolved | unresolved` field on all outbound entries
- [x] 5.3 Ensure messaging entries always have `direction: consumer | publisher`

## 6. Verification

- [x] 6.1 Run on libernetix (Turborepo, NestJS + React) — verify connection_points has inbound HTTP + outbound HTTP from frontend
- [x] 6.2 Run on Nami/backend1 (NestJS monorepo, Kafka+NATS) — verify messaging inbound with topic + schema from contract files
- [x] 6.3 Verify no endpoints.yaml or integrations.yaml produced
- [x] 6.4 Verify .fabrick/tmp/ cleaned up after run
- [ ] 6.5 Verify Haiku invoked for scanner phase (check model in output or logs)
