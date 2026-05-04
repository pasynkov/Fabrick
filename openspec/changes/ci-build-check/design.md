## Context

`ci-implementation.yml` currently runs e2e tests only for `applications/backend/api`. Console and landing are never touched. Build failures in these apps are caught for the first time in `cd-release` deploy jobs — after the manual approval gate. This creates a feedback loop that is too late and too expensive to fix.

## Goals / Non-Goals

**Goals:**
- Catch TypeScript and Vite build failures before archive/promote in ci-implementation
- Auto-fix build errors via AI agent so the pipeline self-heals

**Non-Goals:**
- Running unit tests for console/landing (only build check)
- Deploying or validating runtime behavior of built artifacts
- Caching build outputs across runs

## Decisions

### Step placement: after review-fix, before archive

```
apply → simplify → review → review-fix → [build-check] → [build-fix] → archive → promote
```

Placing after review-fix ensures we check the final post-review state. Placing before archive avoids archiving a change that leaves broken builds.

### Console build needs VITE_API_URL

Vite fails at build time if required env vars are missing. Use `VITE_API_URL=https://placeholder` — the value is irrelevant for TypeScript compilation, only presence matters.

### Conditional AI fix step

Use `continue-on-error: true` on the build check bash step, then a conditional `claude-code-base-action` step with `if: steps.build_check.outcome == 'failure'`. After AI fixes, re-run builds to verify.

```yaml
- name: Build check
  id: build_check
  continue-on-error: true
  run: |
    npm run build --prefix applications/backend/api
    VITE_API_URL=https://placeholder npm run build --prefix applications/console
    npm run build --prefix applications/landing

- name: Fix build errors
  if: steps.build_check.outcome == 'failure'
  uses: anthropics/claude-code-base-action@beta
  with:
    prompt: "Fix TypeScript/Vite build errors..."

- name: Re-run builds after fix
  if: steps.build_check.outcome == 'failure'
  run: |
    npm run build --prefix applications/backend/api
    VITE_API_URL=https://placeholder npm run build --prefix applications/console
    npm run build --prefix applications/landing

- name: Commit build fixes
  if: steps.build_check.outcome == 'failure'
  run: |
    git add -A
    git diff --staged --quiet || git commit -m "fix: build errors for ${{ steps.name.outputs.name }}"
```

### Scope of AI fix step

AI fix step constraints mirror the review-fix step: no workflow files, no test files, no git commands, fix implementation code only.

## Risks / Trade-offs

- **False positives on VITE_API_URL**: If console build requires additional env vars beyond `VITE_API_URL`, builds may fail despite correct code. Mitigation: inspect console build config if this occurs and add vars to the step.
- **AI fix timeout**: If compilation errors are severe (e.g., major API mismatch), 30-minute timeout may not be enough. Mitigation: same timeout as other AI steps; pipeline fails with clear error.
- **api build already implicitly checked**: The e2e test step (`npm run test:e2e`) requires a successful compilation, but it's not the same as an explicit build. Adding explicit build for api makes the contract explicit.
