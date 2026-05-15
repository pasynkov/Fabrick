## 1. CSV export

- [ ] 1.1 Add `/api/projects/:id/tokens.csv` endpoint to `services/api` returning rolled-up rows.
- [ ] 1.2 Stream rows from Cosmos with pagination.

## 2. Frontend wiring

- [ ] 2.1 Add "Export CSV" button to `applications/landing/src/dashboard/tokens-panel.tsx`.
- [ ] 2.2 Gate the button behind `feature.tokens-csv-export`.

## 3. Mechanical

- [ ] 3.1 Rename old column `tok_total` → `tokens_total` in `infrastructure/cosmos.tf`.
- [ ] 3.2 Update README link to the new dashboard panel.
