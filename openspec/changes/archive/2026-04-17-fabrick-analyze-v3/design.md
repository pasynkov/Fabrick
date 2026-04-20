## Context

Extends `fabrick-analyze` v2 in-place. All existing output files retained except `endpoints.yaml` and `integrations.yaml` → replaced by `connection_points.yaml`.

Skill now runs as three coordinated agents within a single Claude Code session. Communication between agents happens through files in `.fabrick/tmp/`.

## Goals / Non-Goals

**Goals:**
- Split monolith into orchestrator + scanner (Haiku) + synthesis (Sonnet)
- Scanner uses semantic tracing, not pure grep
- connection_points.yaml unifies inbound/outbound across all protocols
- patterns.md accumulates learned extraction patterns across loop iterations
- Messaging schemas (Kafka/NATS/gRPC) extracted alongside HTTP schemas
- Frontend outgoing calls captured best-effort with unresolved fallback

**Non-Goals:**
- Multi-process execution (all agents run sequentially in one session via sub-invocations)
- Full AST parsing (file reading + LLM understanding is sufficient)
- 100% coverage of outgoing calls (best-effort, depth-2 trace max)
- Breaking changes to meta.yaml, envs.yaml, domain.md, overview.md, logic.md

## Agent Architecture

### Orchestrator (SKILL.md, current model = Sonnet)

Responsibilities:
1. Phase 0: setup, monorepo detection
2. Write scanner task to `.fabrick/tmp/scanner-task.md`
3. Invoke scanner: `claude -p "$(cat .fabrick/tmp/scanner-task.md)" --model claude-haiku-4-5-20251001`
4. Read `.fabrick/tmp/raw-extraction.yaml` produced by scanner
5. Run synthesis phase (in current Sonnet session — no sub-invocation needed)
6. Write final output files, clean up tmp/

### Scanner (scanner.md, Haiku)

Input: `.fabrick/tmp/scanner-task.md` (contains: repo path, app subdirectory if monorepo, patterns.md content)
Output: `.fabrick/tmp/raw-extraction.yaml`

Responsibilities:
- Framework/language detection
- Semantic endpoint discovery (HTTP + messaging)
- Outgoing call discovery (HTTP client patterns)
- Env var extraction + type inference
- External service inference from deps

Does NOT: write final files, generate descriptions, read deeply into business logic.

### Synthesis (synthesis.md, Sonnet)

Input: `.fabrick/tmp/raw-extraction.yaml` + key source files
Output: All `.fabrick/context/` files

Responsibilities:
- Enrich connection_points with schemas and descriptions
- Write overview.md, logic.md, domain.md
- Enrich envs.yaml with descriptions

## Semantic Scanning Strategy

Pure grep → semantic scan. Three passes:

**Pass 1: File candidates** (grep)
Find files likely containing endpoints/handlers:
- `*controller*`, `*router*`, `*handler*`, `*resolver*` in path
- Contains known decorator/annotation patterns

**Pass 2: Haiku reads candidate files**
For each candidate file, Haiku:
1. Identifies endpoint declarations (standard and non-standard)
2. If unknown decorator → traces to its definition (depth 1)
3. Reads `patterns.md` before starting — knows project-specific abstractions
4. Outputs structured list: `{ type, method/topic, path/subject, file, line, schema_hint }`

**Pass 3: Outgoing call discovery**
1. Grep for known HTTP client patterns: `fetch(`, `axios`, `HttpService`, `http.request`, `requests.get/post`
2. If abstraction layer found (e.g. `apiClient.X()`) → trace to definition (depth 2 max)
3. If unresolved after depth 2 → record with `status: unresolved, hint: "manual review"`

## connection_points.yaml Design

Replaces both `endpoints.yaml` and `integrations.yaml`. Single file, two sections.

**inbound**: what this service receives
- `type`: http | kafka | nats | grpc | websocket | rabbitmq | graphql-query | graphql-mutation | graphql-subscription
- HTTP fields: method, path
- Messaging fields: topic/subject/queue, direction (always consumer for inbound)
- Common: description, schema.message or schema.request+response, file

**outbound**: what this service calls or publishes
- `type`: same set
- HTTP fields: target (name), target_env (env var holding URL), method, path
- Messaging fields: topic/subject, direction (always publisher for outbound)
- `status`: resolved | unresolved (for cases where trace failed)
- Common: description, schema

**Why unified**: synthesis reads connection_points from all services → matches outbound of A with inbound of B → builds integration graph without heuristics.

## patterns.md Design

Append-only. Loop writes new patterns when it finds extractions that required non-standard tracing. Scanner reads this file at the start of each scan.

Format:
```markdown
## [framework/pattern name]
**Trigger**: what to look for in code
**Action**: what to do when found
**Example**: minimal code snippet
```

Initially empty. Loop populates after discovering patterns on real repos.

## Tmp File Protocol

```
.fabrick/tmp/
  scanner-task.md      # written by orchestrator, read by scanner
  raw-extraction.yaml  # written by scanner, read by orchestrator/synthesis
```

Cleaned up after successful run. Preserved on error for debugging.

## Risks / Trade-offs

- `claude` CLI sub-invocation for Haiku: adds latency (~10-30s per invocation), but saves cost on large repos with many files
- Depth-2 trace for outgoing calls: misses deep abstractions, but covers 80% of cases in practice
- patterns.md grows unbounded: in practice, patterns are finite (10-50 total), not a concern
- connection_points.yaml is a breaking change for downstream consumers (synthesis, push): acceptable — v3 is an explicit upgrade
