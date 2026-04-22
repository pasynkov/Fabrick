## 1. Test Suite Setup

- [ ] 1.1 Create `tests/user-journey/package.json` — standalone package with jest, execa, node-fetch as dependencies
- [ ] 1.2 Create `tests/user-journey/jest.config.js` — testTimeout: 180000, testMatch: `**/*.test.ts`
- [ ] 1.3 Create `tests/user-journey/tsconfig.json` — extend root tsconfig, target `tests/user-journey/src/`

## 2. Test Helpers

- [ ] 2.1 Create `tests/user-journey/src/helpers/api.ts` — thin fetch wrapper targeting `process.env.API_URL`
- [ ] 2.2 Create `tests/user-journey/src/helpers/cli.ts` — execa wrapper spawning local CLI binary with `FABRICK_API_URL` env
- [ ] 2.3 Create `tests/user-journey/src/helpers/poll.ts` — polling helper with exponential backoff, max 20 attempts × 5s

## 3. Journey Test

- [ ] 3.1 Create `tests/user-journey/src/journey.test.ts` — full flow test:
  - Generate unique user email (`journey-<uuid>@fabrick.local`)
  - Register via API helper
  - `fabrick login` via CLI helper
  - `fabrick init` (org + repo) via CLI helper
  - `fabrick push` with fixture directory via CLI helper
  - POST to trigger synthesis via API helper
  - Poll synthesis status until `completed` or timeout
  - GET synthesis output blob URL
  - Assert output is non-empty JSON

## 4. Test Fixtures

- [ ] 4.1 Create `tests/user-journey/fixtures/sample-repo/` — minimal sample codebase for context upload (2-3 source files)

## 5. CI Integration

- [ ] 5.1 Verify `tests/user-journey` is referenced in `.github/workflows/staging.yml` (cicd-pipeline change task 6.4)
- [ ] 5.2 Confirm `API_URL` env var is exported from Terraform outputs before test step runs
- [ ] 5.3 Run full staging workflow on a test release branch and verify journey test completes

## 6. Verification

- [ ] 6.1 Run journey tests locally against deployed staging environment to verify they pass before CI integration
- [ ] 6.2 Intentionally fail a step and verify logs are collected and uploaded as artifact
- [ ] 6.3 Verify environment is destroyed after both pass and fail outcomes
