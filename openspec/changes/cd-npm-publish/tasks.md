## 1. Prepare packages for publishing

- [x] 1.1 Add `"publishConfig": { "access": "public" }` to `applications/cli/package.json`
- [x] 1.2 Add `"publishConfig": { "access": "public" }` to `applications/mcp/package.json`

## 2. Create publish workflow

- [x] 2.1 Create `.github/workflows/cd-npm-publish.yml` with `workflow_dispatch` trigger and inputs: `package` (cli/mcp/both), `version_bump` (patch/minor/major)
- [x] 2.2 Add matrix strategy that expands `both` into `[cli, mcp]` and single values into `[cli]` or `[mcp]`
- [x] 2.3 Add `concurrency` group per package name to prevent parallel runs
- [x] 2.4 Add checkout step with `fetch-depth: 0` and git user config for bot commits
- [x] 2.5 Add Node.js setup step with npm cache
- [x] 2.6 Add `npm ci` + `npm run build` steps per package directory
- [x] 2.7 Add `npm version ${{ inputs.version_bump }}` step (creates commit, no tags)
- [x] 2.8 Add `git push origin HEAD` step (no `--tags`)
- [x] 2.9 Add `npm publish` step with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

## 3. Configure registry secret

- [x] 3.1 Document in README or runbook: add `NPM_TOKEN` to GitHub repository secrets (Settings → Secrets → Actions → New repository secret)

## 4. Verify

- [ ] 4.1 Run workflow with `package=cli, version_bump=patch` and confirm `@fabrick/cli` is published with bumped version
- [ ] 4.2 Confirm version commit appears in repository, no git tags created
