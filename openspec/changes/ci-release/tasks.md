## 1. Add secrets

- [ ] 1.1 Add GitHub Actions secret `DB_PASSWORD` (value: test-only password, not prod)
- [ ] 1.2 Add GitHub Actions secret `JWT_SECRET` (value: test-only secret)

## 2. Create workflow

- [ ] 2.1 Create `.github/workflows/ci-e2e.yml` with trigger `push: branches: ['release/**']`
- [ ] 2.2 Add `postgres:16` service container with `POSTGRES_DB: fabrick_test`, health check
- [ ] 2.3 Add `e2e-api` job: checkout, node 20, npm ci, npm run test:e2e with DB env vars
- [ ] 2.4 Verify workflow file has no syntax errors (use `act` locally or push to test branch)

## 3. Configure branch protection

- [ ] 3.1 Enable branch protection on `release/**`: require PR to merge to `main`, require `e2e-api` status check

## 4. Verify

- [ ] 4.1 Create `release/0.1` branch from `develop`
- [ ] 4.2 Push → verify ci-e2e triggers, postgres spins up, tests pass
- [ ] 4.3 Confirm `main` branch protection requires green `ci-e2e` for release/* PRs
