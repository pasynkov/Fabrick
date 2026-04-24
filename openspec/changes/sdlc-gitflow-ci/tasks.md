## 1. Modify ci-unit.yml

- [ ] 1.1 Add `'feature/**'` to `push.branches`
- [ ] 1.2 Add `open-pr` job: `needs: [test-api, test-cli, test-mcp]`, `if: startsWith(github.ref, 'refs/heads/feature/')`
- [ ] 1.3 `open-pr` checks for existing PR before creating (idempotent)

## 2. Create ci-pr-check.yml

- [ ] 2.1 Trigger: `pull_request` to `develop`, types `[opened, synchronize, reopened]`
- [ ] 2.2 Single job `pr-check`: `run: exit 0`

## 3. Modify ci-e2e.yml

- [ ] 3.1 Add `develop` to `push.branches` alongside `'release/**'`

## 4. Rework cd-deploy.yml

- [ ] 4.1 Change trigger from `push: branches: [main]` to `workflow_dispatch`
- [ ] 4.2 Add `version-bump` job: extract version from branch name (`release/vX.X.X` → `X.X.X`)
- [ ] 4.3 Bump `package.json` in api, synthesis, console, landing via `npm --prefix <dir> version <ver> --no-git-tag-version`
- [ ] 4.4 Commit and push bump to release branch with bot identity
- [ ] 4.5 Add `needs: [version-bump]` to all existing deploy jobs
- [ ] 4.6 Add `open-pr-to-main` job: `needs: [deploy-api, deploy-synthesis, deploy-console, deploy-landing]`, opens PR `release/* → main`

## 5. Create cd-release-finalize.yml

- [ ] 5.1 Trigger: `pull_request` to `main`, types `[closed]`
- [ ] 5.2 Condition: `merged == true && head.ref starts with release/`
- [ ] 5.3 Extract version from `head.ref`
- [ ] 5.4 Create and push git tag `vX.X.X`
- [ ] 5.5 Open PR `main → develop`

## 6. Test

- [ ] 6.1 Push to `feature/test-sdlc` → verify unit tests run + PR to `develop` opens
- [ ] 6.2 Push second commit to same feature branch → verify no duplicate PR opens
- [ ] 6.3 Merge feature PR to `develop` → verify e2e runs on `develop`
- [ ] 6.4 Create `release/v0.0.1` branch manually and push → verify e2e runs on release branch
- [ ] 6.5 Run `cd-deploy` workflow_dispatch on `release/v0.0.1` → verify: bump commits appear, all 4 apps deploy, PR to `main` opens
- [ ] 6.6 Merge release PR to `main` → verify tag `v0.0.1` created and PR `main → develop` opens
