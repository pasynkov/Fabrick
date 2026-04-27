## 1. Rename and restructure ci-implementation-archive.yml

- [x] 1.1 Rename `.github/workflows/ci-implementation-archive.yml` to `.github/workflows/ci-implementation.yml`
- [x] 1.2 Add `workflow_dispatch:` trigger (no inputs needed — name derived from GITHUB_REF)
- [x] 1.3 Rename existing `archive` job section header comment if present for clarity

## 2. Add apply job

- [x] 2.1 Add `apply` job before `archive` in `ci-implementation.yml` with `permissions: contents: write`
- [x] 2.2 Add `actions/checkout@v4` step with `token: ${{ secrets.GITHUB_TOKEN }}` and `fetch-depth: 0`
- [x] 2.3 Add "Extract change name" step (same pattern as existing archive job: derive from GITHUB_REF)
- [x] 2.4 Add "Check if change needs applying" step: check if `openspec/changes/<name>/` exists, set `needs_apply` output
- [x] 2.5 Add `anthropics/claude-code-base-action@beta` step with `if: steps.check.outputs.needs_apply == 'true'`, model `claude-sonnet-4-6`, allowed tools `Bash,Read,Write,Edit,Glob`, and prompt instructing Claude to invoke the `openspec-apply-change` skill for `<name>`, stay on current branch, not run git commands, best effort
- [x] 2.6 Add "Commit implementation" step with `if: steps.check.outputs.needs_apply == 'true'`: configure git bot identity, `git add -A`, guard with `git diff --staged --quiet`, commit `feat: implement <name>`, `git push`

## 3. Wire archive job to depend on apply

- [x] 3.1 Add `needs: [apply]` to the `archive` job in `ci-implementation.yml`

## 4. Update cd-proposal-promote.yml

- [x] 4.1 Add "Trigger implementation" step after branch creation: `gh workflow run ci-implementation.yml --ref "implementation/$NAME" --repo "$GITHUB_REPOSITORY"` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
