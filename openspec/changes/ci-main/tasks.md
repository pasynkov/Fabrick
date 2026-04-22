## 1. Verify test commands

- [x] 1.1 Check `applications/api` — confirm `npm run test:unit` script exists in package.json
- [x] 1.2 Check `applications/cli` — confirm `npm test` script exists in package.json
- [x] 1.3 Check `packages/mcp` — confirm `npm test` script exists in package.json
- [x] 1.4 Run all three locally, confirm they pass

## 2. Create workflow

- [x] 2.1 Create `.github/workflows/ci-unit.yml` with trigger `push: branches: [main]`
- [x] 2.2 Add `test-api` job: checkout, node 20, npm ci, npm run test:unit
- [x] 2.3 Add `test-cli` job: checkout, node 20, npm ci, npm test
- [x] 2.4 Add `test-mcp` job: checkout, node 20, npm ci, npm test

## 3. Verify

- [ ] 3.1 Push to `main` → verify all three jobs trigger and pass in GitHub Actions
- [x] 3.2 Confirm no secrets required (workflow runs without any configured secrets)
