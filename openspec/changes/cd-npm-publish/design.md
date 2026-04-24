## Context

The repo contains two public npm packages: `@fabrick/cli` (`applications/cli/`) and `@fabrick/mcp` (`applications/mcp/`). The current `cd-deploy.yml` only deploys cloud services; npm publishing is done manually via `npm publish`. We need a controlled CI process with explicit version bump type selection.

## Goals / Non-Goals

**Goals:**
- `workflow_dispatch` with inputs: `package` (cli / mcp / both) and `version_bump` (patch / minor / major)
- Automatic version bump via `npm version` + commit (no git tags)
- Publish to npm via `NPM_TOKEN`
- Minimal third-party action dependencies

**Non-Goals:**
- Auto-trigger on push (publishing is always manual)
- Changelog generation
- Publishing other artifacts (Docker, etc.)

## Decisions

**Single workflow with package matrix**
The `package: cli | mcp | both` input → `strategy.matrix` built dynamically via `fromJson`. Alternative — two separate workflows — duplicates logic.

**`npm version` for bump**
Built-in npm command: updates `package.json` and creates a git commit. Run with `--no-git-tag-version` is an option, but `npm version` without tag push is sufficient — tags are not part of this workflow (deferred to a future flow). Alternative (manual `sed` + jq) — fragile.

**Version commit pushed without tags**
After `npm version`, run `git push origin HEAD` (no `--tags`). Tags are out of scope for now.

**NPM_TOKEN as repository secret**
Standard approach. Token type "Automation" (not "Publish" — no 2FA required on each publish).

## Risks / Trade-offs

- [Concurrent workflow runs for same package] → Mitigation: `concurrency` group per-package prevents parallel bumps of the same package
- [`npm version` creates a commit in CI] → Mitigation: configure `git config user.email github-actions[bot]@users.noreply.github.com` before the step
- [Unsynchronized versions between cli and mcp when using `both`] → Accepted: packages are independent

## Migration Plan

1. Add `NPM_TOKEN` to GitHub repository secrets (Settings → Secrets → Actions)
2. Ensure packages have `"publishConfig": { "access": "public" }` (or use `--access public` flag)
3. Commit the workflow
4. Run workflow manually with `package=cli, version_bump=patch` to verify
