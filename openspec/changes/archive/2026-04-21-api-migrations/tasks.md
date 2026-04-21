## 1. Migration Files

- [x] 1.1 Create `migrations/1700000000000-Init.ts` — CREATE TABLE for `users`, `organizations`, `org_members`, `projects`, `repositories` with correct columns, constraints, and FK cascades
- [x] 1.2 Create `migrations/index.ts` — export `[Init1700000000000, DropCliTokens1745000000000]` array

## 2. App Module

- [x] 2.1 Update `app.module.ts`: set `synchronize: false`, `migrationsRun: true`, import and pass `migrations` array from `migrations/index.ts`

## 3. Verify

- [x] 3.1 Start API locally against fresh DB — confirm all 5 tables created, app starts clean
