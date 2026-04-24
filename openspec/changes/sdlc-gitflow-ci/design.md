## Context

Current workflows:
- `ci-unit.yml` — push to `main`/`develop` + PR to same; no `feature/**`
- `ci-e2e.yml` — push to `release/**` only
- `cd-deploy.yml` — auto on push to `main` (wrong)
- `cd-npm-publish.yml` — `workflow_dispatch` (untouched by this change)

Package paths for version bump:
- `applications/backend/api`
- `applications/backend/synthesis`
- `applications/console`
- `applications/landing`

## Goals / Non-Goals

**Goals:**
- Automated unit tests on `feature/**` + auto PR to `develop` on pass
- Mock required check on PRs to `develop`
- E2E on `develop` push
- Manual deploy from `release/*` with version from branch name
- Auto PR to `main` after deploy
- Auto tag + sync PR on merge to `main`

**Non-Goals:**
- Auto-create release branch (manual for now)
- Branch protection rules
- PAT or bot account (all ops use `GITHUB_TOKEN`)
- CLI/MCP version bump (separate npm publish flow)

## Decisions

### GITHUB_TOKEN is sufficient

All required operations (open PR, create tag, push to non-protected branch) work with `GITHUB_TOKEN`. The only case where it would fail is triggering downstream workflows via push — but the release branch is created manually, so that push already uses a human token and triggers `ci-e2e.yml` correctly.

### open-pr job is idempotent

Before calling `gh pr create`, the job checks if a PR already exists for the branch. Subsequent pushes to the same feature branch will not open duplicate PRs.

### Version bump commits before deploy jobs

`version-bump` job runs first and pushes to the release branch. All deploy jobs declare `needs: [version-bump]` and re-checkout, so they build the bumped code.

### cd-release-finalize uses pull_request closed event

`pull_request` events triggered by humans (not `GITHUB_TOKEN` push) do fire downstream workflows. Using `types: [closed]` with `merged == true` is the standard pattern.

---

## Workflow Designs

### ci-unit.yml (modified)

```yaml
name: CI Unit Tests

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --legacy-peer-deps
        working-directory: applications/backend/api
      - run: npm run test:unit
        working-directory: applications/backend/api

  test-cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
        working-directory: applications/cli
      - run: npm test
        working-directory: applications/cli

  test-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
        working-directory: applications/mcp
      - run: npm test
        working-directory: applications/mcp

  open-pr:
    needs: [test-api, test-cli, test-mcp]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/heads/feature/')
    steps:
      - name: Open PR to develop
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BRANCH="${GITHUB_REF#refs/heads/}"
          existing=$(gh pr list --repo "$GITHUB_REPOSITORY" --base develop --head "$BRANCH" --json number --jq '.[0].number')
          if [ -z "$existing" ]; then
            gh pr create \
              --repo "$GITHUB_REPOSITORY" \
              --base develop \
              --head "$BRANCH" \
              --title "${BRANCH#feature/}" \
              --body "Automated PR from \`$BRANCH\`."
          fi
```

### ci-pr-check.yml (new)

```yaml
name: CI PR Check

on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened]

jobs:
  pr-check:
    runs-on: ubuntu-latest
    steps:
      - run: exit 0
```

### ci-e2e.yml (modified)

```yaml
on:
  push:
    branches: [develop, 'release/**']
```

### cd-deploy.yml (reworked)

```yaml
name: CD Deploy

on:
  workflow_dispatch:

jobs:
  version-bump:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.extract.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Extract version from branch name
        id: extract
        run: |
          BRANCH="${GITHUB_REF#refs/heads/}"
          VERSION="${BRANCH#release/v}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Bump package versions
        run: |
          for dir in applications/backend/api applications/backend/synthesis applications/console applications/landing; do
            npm --prefix "$dir" version "${{ steps.extract.outputs.version }}" --no-git-tag-version
          done
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add \
            applications/backend/api/package.json \
            applications/backend/synthesis/package.json \
            applications/console/package.json \
            applications/landing/package.json
          git commit -m "chore: bump version to ${{ steps.extract.outputs.version }}"
          git push

  deploy-api:
    needs: [version-bump]
    runs-on: ubuntu-latest
    steps:
      # ... same as current, with actions/checkout@v4 re-checkout ...

  deploy-synthesis:
    needs: [version-bump]
    # ... same as current ...

  deploy-console:
    needs: [version-bump]
    # ... same as current ...

  deploy-landing:
    needs: [version-bump]
    # ... same as current ...

  open-pr-to-main:
    needs: [deploy-api, deploy-synthesis, deploy-console, deploy-landing]
    runs-on: ubuntu-latest
    steps:
      - name: Open PR to main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BRANCH="${GITHUB_REF#refs/heads/}"
          gh pr create \
            --repo "$GITHUB_REPOSITORY" \
            --base main \
            --head "$BRANCH" \
            --title "release: ${BRANCH#release/}" \
            --body "Automated release PR from \`$BRANCH\`. All deploy jobs passed."
```

### cd-release-finalize.yml (new)

```yaml
name: CD Release Finalize

on:
  pull_request:
    branches: [main]
    types: [closed]

jobs:
  finalize:
    if: github.event.pull_request.merged == true && startsWith(github.event.pull_request.head.ref, 'release/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Extract version
        id: version
        run: |
          REF="${{ github.event.pull_request.head.ref }}"
          VERSION="${REF#release/}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
      - name: Create tag
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git tag "${{ steps.version.outputs.version }}"
          git push origin "${{ steps.version.outputs.version }}"
      - name: Open PR main to develop
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr create \
            --repo "$GITHUB_REPOSITORY" \
            --base develop \
            --head main \
            --title "chore: sync ${{ steps.version.outputs.version }} to develop" \
            --body "Post-release sync of \`main\` into \`develop\`."
```
