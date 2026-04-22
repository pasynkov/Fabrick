## 1. Add secrets

- [x] 1.1 Add GitHub Actions secret `DB_PASS` (value: test-only password, not prod)
- [x] 1.2 Add GitHub Actions secret `JWT_SECRET` (value: test-only secret)

## 2. Create workflow

- [x] 2.1 Create `.github/workflows/ci-e2e.yml` with trigger `push: branches: ['release/**']`
- [x] 2.2 Add `postgres:16` service container with `POSTGRES_DB: fabrick_test`, health check
- [x] 2.3 Add `e2e-api` job: checkout, node 20, npm ci, npm run test:e2e with DB env vars
- [x] 2.4 Verify workflow file has no syntax errors (use `act` locally or push to test branch)

## 3. Configure branch protection

- [x] 3.1 ~~Enable branch protection on `release/**`~~ — not needed, release branches push directly from develop

## 4. Verify

- [x] 4.1 Create `release/0.1` branch from `develop`
- [x] 4.2 Push → verify ci-e2e triggers, postgres spins up, tests pass
- [x] 4.3 ~~Confirm `main` branch protection requires green `ci-e2e` for release/* PRs~~ — not applicable
