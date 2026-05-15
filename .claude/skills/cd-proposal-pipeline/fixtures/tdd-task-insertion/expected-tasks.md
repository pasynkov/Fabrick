## 1. CSV export

- [ ] 1.1 Write failing integration test for `/api/projects/:id/tokens.csv` endpoint covering happy-path rows + auth rejection.
- [ ] 1.2 Add `/api/projects/:id/tokens.csv` endpoint to `services/api` returning rolled-up rows.
- [ ] 1.3 Write failing unit test for the Cosmos pagination iterator over a fixture page boundary.
- [ ] 1.4 Stream rows from Cosmos with pagination.

## 2. Frontend wiring

- [ ] 2.1 Write failing component test for `tokens-panel.tsx` "Export CSV" button rendering when the feature flag is enabled.
- [ ] 2.2 Add "Export CSV" button to `applications/landing/src/dashboard/tokens-panel.tsx`.
- [ ] 2.3 Modify existing feature-flag selector test to assert `feature.tokens-csv-export` gates the button (now failing).
- [ ] 2.4 Gate the button behind `feature.tokens-csv-export`.

## 3. Mechanical

- [ ] 3.1 Rename old column `tok_total` → `tokens_total` in `infrastructure/cosmos.tf` [no-test] (rename-only edit, schema migration covered by infra apply).
- [ ] 3.2 Update README link to the new dashboard panel [no-test] (doc-only).
