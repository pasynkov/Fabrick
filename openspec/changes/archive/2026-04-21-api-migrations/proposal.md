## Why

API uses `synchronize: true` which is dangerous in production — TypeORM will auto-alter or drop columns when entities change. Must switch to explicit migration-based schema management before cloud deployment.

## What Changes

- Set `synchronize: false`, `migrationsRun: true` in API `app.module.ts`
- Add `migrations/index.ts` exporting explicit migrations array (Nami/harvester pattern)
- Create `migrations/1700000000000-Init.ts` — CREATE TABLE for all 5 tables from scratch: `users`, `organizations`, `org_members`, `projects`, `repositories`
- Keep existing `1745000000000-DropCliTokens.ts` (uses `IF EXISTS` — no-op on fresh DB, cleans up on upgrade)

## Capabilities

### New Capabilities

- `db-migrations`: Schema versioning via TypeORM migrations — explicit migration files, `migrationsRun: true`, no synchronize

### Modified Capabilities

- `user-auth`: No behavior change, but schema now managed via migrations instead of synchronize

## Impact

- `applications/backend/api/src/app.module.ts` — TypeORM config change
- `applications/backend/api/src/migrations/` — new `index.ts` + `Init` migration
- No API contract changes, no entity changes
- TypeORM handles concurrent migration runs via locking — safe for multi-instance and Azure Functions
- No `data-source.ts` needed — `migrationsRun: true` sufficient
