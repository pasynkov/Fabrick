## Context

API currently uses `synchronize: true` — TypeORM auto-alters the DB schema on startup to match entities. Dangerous in production: renaming an entity field drops the old column and creates a new one, losing data. Must switch to explicit versioned migrations before multi-instance or Azure Functions deployment.

Nami/harvester already uses the target pattern: `synchronize: false`, `migrationsRun: true`, explicit migrations array in `database/index.ts`.

## Goals / Non-Goals

**Goals:**
- Replace `synchronize: true` with migration-based schema management
- Schema deployable from scratch via migrations alone (no manual steps)
- Safe for concurrent startup (multi-instance API, Azure Functions cold starts)

**Non-Goals:**
- `data-source.ts` / typeorm CLI tooling (not needed, `migrationsRun: true` is sufficient)
- Migrating existing production data (no prod DB yet)
- Shared entities package (deferred to future architecture change)

## Decisions

### migrationsRun: true vs separate CI/CD step

**Decision**: `migrationsRun: true` in `app.module.ts`.

Alternatives:
- CI/CD pipeline step (`typeorm migration:run`) — cleaner for serverless, but requires `data-source.ts` and pipeline access to DB
- `migrationsRun: true` — simpler, TypeORM uses advisory lock so concurrent runs are safe, overhead is one `SELECT` against migrations table per cold start (acceptable)

For Azure Functions: cold start overhead is minimal. Lock prevents double-execution. Same pattern already proven in Nami.

### Single Init migration for all tables

**Decision**: One `Init` migration creates all 5 tables. Existing `DropCliTokens` migration stays.

`DropCliTokens` uses `DROP TABLE IF EXISTS` — no-op on fresh DB, cleans up legacy schema on upgrade. No conflict.

### Migrations stay in API

**Decision**: Migrations live in `api/src/migrations/` for now.

When API becomes stateless and a dedicated core-db service is introduced, migrations move there. Premature to extract now.

## Risks / Trade-offs

- **Concurrent cold starts**: TypeORM acquires a lock before running migrations — only first instance proceeds, others wait and see migrations already applied. Low risk.
- **Migration drift**: If entities change without a migration, `synchronize: false` means the DB silently falls out of sync. Mitigation: discipline — any entity change requires a migration.

## Migration Plan

1. Add `migrations/index.ts` exporting `[Init, DropCliTokens]`
2. Add `migrations/1700000000000-Init.ts` creating all 5 tables
3. Update `app.module.ts`: `synchronize: false`, `migrationsRun: true`, pass `migrations`
4. Verify: start API locally against fresh DB — tables created, no errors
