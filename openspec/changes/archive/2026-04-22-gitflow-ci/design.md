## Context

`ci-main` gave us CI on push to `main`. Now we establish proper branch hygiene: `develop` as integration branch, `feature/*` convention, protection rules that enforce the PR flow.

## Goals / Non-Goals

**Goals:**
- `develop` branch exists and is protected
- `main` requires PR + green CI to merge
- CI triggers on PR (any base) and push to `develop`
- `feature/*` convention documented and enforced by protection

**Non-Goals:**
- E2e tests (ci-release)
- Release branch lifecycle (ci-release)
- Deployment (cd-deploy)

## Decisions

### Branch model

```
feature/* ──PR──▶ develop ──PR──▶ release/* ──PR──▶ main
hotfix/*  ──PR──▶ main (fast path, rare)
```

`develop` created from current `main`. All new work starts from `feature/*` branches cut from `develop`.

### ci-unit.yml trigger update

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

Jobs unchanged — same three parallel unit test jobs.

### Branch protection rules

| Branch    | Require PR | Required status checks | Allow direct push |
|-----------|-----------|----------------------|-------------------|
| `main`    | yes       | `ci-unit / test-api`, `test-cli`, `test-mcp` | no |
| `develop` | yes       | `ci-unit / test-api`, `test-cli`, `test-mcp` | no |

Branch protection configured via GitHub UI or `gh` CLI — not via workflow file.
