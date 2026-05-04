## Why

`ci-implementation` only runs e2e tests against the API — it never runs `npm run build` for any application. TypeScript compilation errors in console, landing, or API pass CI silently and only surface as failures in `cd-release` deploy jobs, after the approval gate.

## What Changes

- Add a build verification step to `ci-implementation.yml` after `review-fix` commit, before `archive`
- Add an AI-driven build fix step: if any build fails, Claude fixes the compilation errors and commits
- Console build uses `VITE_API_URL=https://placeholder` (env var required by Vite but value irrelevant for type-checking)

## Capabilities

### New Capabilities

- `ci-build-verification`: Build verification and auto-fix step in the ci-implementation pipeline — runs `npm run build` for all applications and uses an AI agent to fix any failures before archiving

### Modified Capabilities

_(no requirement changes to existing capabilities)_

## Impact

- `.github/workflows/ci-implementation.yml` — two new steps added between `review-fix` commit and `archive`
- No new dependencies
- No changes to application code or other workflows
