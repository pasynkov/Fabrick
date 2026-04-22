## 1. Create develop branch

- [x] 1.1 Create `develop` branch from current `main`
- [x] 1.2 Push `develop` to origin

## 2. Update ci-unit.yml triggers

- [x] 2.1 Update `.github/workflows/ci-unit.yml` — add `pull_request` trigger and `push: branches: [main, develop]`
- [x] 2.2 Push to `develop` → verify ci-unit triggers

## 3. Configure branch protection

- [x] 3.1 Enable branch protection on `main`: require PR, require status checks `test-api` + `test-cli` + `test-mcp`, disallow direct push
- [x] 3.2 Enable branch protection on `develop`: require PR, require same status checks
- [x] 3.3 Verify: attempt direct push to `main` → rejected

## 4. Verify full flow

- [x] 4.1 Create `feature/test-gitflow` branch from `develop`
- [x] 4.2 Make trivial change, push, open PR to `develop`
- [x] 4.3 Confirm CI runs, all jobs green, PR mergeable
- [x] 4.4 Delete test branch after verification
