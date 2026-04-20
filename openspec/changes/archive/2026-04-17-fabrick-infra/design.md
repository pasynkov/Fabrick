## Context

No infrastructure exists yet. This is the foundation for the entire Fabrick PoC — everything else depends on MinIO and the NestJS service being up. Both run locally via Docker Compose.

## Goals / Non-Goals

**Goals:**
- MinIO running locally on ports 9000 (API) and 9001 (console)
- NestJS skeleton running on port 3000 with a `/health` endpoint
- Bucket `fabrick` auto-created on NestJS startup
- Single `docker-compose up` brings everything up

**Non-Goals:**
- Production-grade config (TLS, secrets management, etc.)
- NestJS business logic (comes in fabrick-backend-api)
- Any auth

## Decisions

### docker-compose in `applications/backend/`
Both services live together. NestJS has its own `Dockerfile` inside `applications/backend/api/`.

### MinIO credentials
Use `minioadmin` / `minioadmin` for local dev — simple, no secrets needed.

### Bucket auto-creation on startup
NestJS `OnModuleInit` creates the `fabrick` bucket if it doesn't exist, using the MinIO SDK. Avoids manual setup step.

### NestJS skeleton
Just `AppModule` + `HealthController` (`GET /health → 200 OK`). Real endpoints come in the next change.

```
applications/backend/
├── docker-compose.yml
└── api/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app.module.ts
        └── health/
            └── health.controller.ts
```

## Risks / Trade-offs

- MinIO data is not persisted across `docker-compose down -v` → fine for PoC, use named volume to persist if needed
