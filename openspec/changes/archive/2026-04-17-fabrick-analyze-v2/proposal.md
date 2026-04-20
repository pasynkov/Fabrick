## Why

The current `fabrick-analyze` skill produces shallow, TypeScript-only context. Env vars are name-only lists. Endpoints have no schema. Dependencies are tech noise. Non-HTTP integrations (kafka, nats, grpc) are missed entirely. Monorepos break the single-app assumption. Business rules and domain semantics are not extracted. The result is context that's insufficient for a downstream agent to answer meaningful questions about a service.

## What Changes

- Upgrade `.claude/skills/fabrick-analyze/SKILL.md`
- Richer structured extraction across all output files
- New output files: `integrations.yaml`, `domain.md`, `cross-app.yaml`
- Remove `dependencies.yaml`
- Monorepo detection and per-app output structure
- Polyglot support: Java, Python, .NET, Go, Rust, C++
- DevOps repo support: Terraform, Helm, Kustomize, ArgoCD, K8s manifests

## Capabilities

### Modified Capabilities

- `fabrick-analyze`: Extended extraction scope, richer output schema, monorepo support

## Output Schema Changes

### envs.yaml (enriched)
```yaml
envVars:
  - name: MINIO_ENDPOINT
    description: S3-compatible storage URL
    type: url
    safe_to_share: true
  - name: LOG_LEVEL
    type: enum
    values: [debug, info, warn, error]
    safe_to_share: true
  - name: JWT_SECRET
    type: secret
    safe_to_share: false
```

### endpoints.yaml (enriched)
```yaml
endpoints:
  - method: POST
    path: /payments
    description: Create a new payment intent
    request:
      body: { amount: number, currency: string, userId: string }
    response:
      body: { paymentId: string, status: string }
    file: src/payments/payments.controller.ts
```

### integrations.yaml (new)
```yaml
integrations:
  - type: kafka
    topic: orders.created
    direction: consumer
    file: src/orders/orders.consumer.ts
  - type: nats
    subject: payment.completed
    direction: publisher
    file: src/payments/payments.service.ts
  - type: postgres
    role: primary-db
  - type: redis
    role: cache
```

### domain.md (new)
Entities, business rules, key flows extracted from code — not README.

### cross-app.yaml (new, monorepo only)
```yaml
communications:
  - from: payments-service
    to: notification-service
    via: nats
    subject: payment.completed
shared_packages:
  - name: "@myorg/types"
    used_by: [payments-service, user-service]
```

### Monorepo output structure
```
.fabrick/context/
  meta.yaml              # repo-level, monorepo: true
  apps/
    <app-name>/
      meta.yaml
      endpoints.yaml
      envs.yaml
      integrations.yaml
      overview.md
      logic.md
      domain.md
  cross-app.yaml
```

### Removed
- `dependencies.yaml` — tech noise, not business context

## Impact

- Modified file: `.claude/skills/fabrick-analyze/SKILL.md`
- Output schema change: downstream consumers (fabrick-push, fabrick-synthesis) need to handle new structure
- Monorepo repos produce nested output instead of flat `.fabrick/context/`
