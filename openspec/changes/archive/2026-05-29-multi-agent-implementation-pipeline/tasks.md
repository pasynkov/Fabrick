## 1. Subagent definitions

- [x] 1.1 Write a unit test (e.g. a Markdown linter / structural check) that fails when an agent file under `.claude/agents/` lacks one of: frontmatter `model`, frontmatter `tools` containing `Bash`/`Read`/`Write`/`Edit`/`Skill`, an `ERROR:` failure convention line in the body, or a documented test-edit boundary.
- [x] 1.2 Create `.claude/agents/change-applier.md` with model + tools frontmatter, body documenting: invoke `openspec-apply-change`, free to add/modify e2e tests, forbid `.github/workflows/`, run `cd applications/backend/api && npm run test:e2e` to green, commit `feat: apply <name>`, return short summary, signal failure via `ERROR:`.
- [x] 1.3 Create `.claude/agents/simplifier.md` with model + tools frontmatter, body documenting: invoke `simplify`, forbid test-file edits (`*.spec.ts`, `*.test.ts`, `*.e2e.ts`, `**/test/**`), forbid `.github/workflows/`, run e2e to green, commit `refactor: simplify <name>`, `ERROR:` convention.
- [x] 1.4 Create `.claude/agents/reviewer.md` with model + tools frontmatter, body documenting: invoke `review` then `review-fix`, forbid test-file edits, validate TDD coverage of new behaviour from the applier's commit, on TDD gap return `ERROR: TDD gap on <task-refs>` without adding the missing tests, run e2e to green, commit `fix: review fixes for <name>`.
- [x] 1.5 Create `.claude/agents/build-fixer.md` with model + tools frontmatter, body documenting: fix source code so the listed failed builds pass, minor test edits permitted only when a test file is the cause, forbid `package.json`/`tsconfig.json`/`.github/workflows/`/build configs, re-run only the failing apps, commit `fix: build failures for <name>`.
- [x] 1.6 Create `.claude/agents/archiver.md` with model + tools frontmatter, body documenting: invoke `openspec-archive-change` non-interactively (skip sync prompts, proceed if incomplete), forbid `AskUserQuestion`, mutate only under `openspec/changes/` and `openspec/changes/archive/`, commit `chore: archive <name>`.
- [x] 1.7 Verify the agent-file structural test from 1.1 passes for all five new agent files.

## 2. Orchestrator skill

- [x] 2.1 Write a structural test for `.claude/skills/cd-implementation-pipeline/SKILL.md` that fails until the file exists and contains: skill frontmatter, the literal text of all seven step headings (`Step 0` through `Step 7`), the doer-commit contract, the per-step retry table, the build-attempt budget table, the TDD-bounce policy, and the unified argv signature.
- [x] 2.2 Create `.claude/skills/cd-implementation-pipeline/SKILL.md` with frontmatter (`name`, `description`, `license`, `metadata`) declaring it as the orchestrator skill that takes `<repo> <change-name>` positional arguments.
- [x] 2.3 In the skill body, document state derivation: parse `<change-name>` from argv, parse leading numeric `<issue>` if present, compute stage-skip flags via `git log --grep` for apply/simplify/review and `openspec/changes/archive/*-<name>` presence for archive.
- [x] 2.4 Document step 0 (gh-ops label `implementation:apply`) including the no-issue-id edge case.
- [x] 2.5 Document step 1 (change-applier) including the skip condition and the abort-on-second-failure policy.
- [x] 2.6 Document step 2 (simplifier) including the skip condition and the warn-and-continue-on-second-failure policy.
- [x] 2.7 Document step 3 (reviewer) including the skip condition, the abort-on-crash second-failure policy, and the TDD-bounce policy with the one-bounce cap.
- [x] 2.8 Document step 4 (parallel builds + build-fixer) including: the exact set of six `Bash` calls in one orchestrator response, the build-attempt budget of three, and the `partial-red` flag on still-failing builds.
- [x] 2.9 Document step 5 (archiver) including the skip condition (archive directory existence) and the abort-on-second-failure policy.
- [x] 2.10 Document step 6 (git-ops push) including the abort-on-second-failure policy.
- [x] 2.11 Document step 7 (promote: git-ops rename + push, gh-ops PR open + label swap + issue comment) including idempotency and the partial-red flag flowing into the PR body.
- [x] 2.12 Verify the structural test from 2.1 passes.

## 3. Fixtures

- [x] 3.1 Write a structural test asserting that `.claude/skills/cd-implementation-pipeline/fixtures/sample-branch.md` exists and contains at least one branch-to-change-name derivation example, including a leading-issue-id stripping case.
- [x] 3.2 Create `.claude/skills/cd-implementation-pipeline/fixtures/sample-branch.md`.
- [x] 3.3 Write a structural test asserting that `.claude/skills/cd-implementation-pipeline/fixtures/sample-change/` is a valid `openspec/changes/<name>/` tree (has `proposal.md`, `design.md`, `tasks.md`, at least one `specs/<capability>/spec.md`, and an `.openspec.yaml`).
- [x] 3.4 Create the `fixtures/sample-change/` tree satisfying 3.3.
- [x] 3.5 Verify both fixture tests pass.

## 4. Workflow file rename and rewrite

- [x] 4.1 Write a workflow-shape test (CI lint or a structural Markdown/YAML check) that fails until `.github/workflows/cd-implementation.yml` exists, contains a `push` trigger on `implementation/**`, contains `workflow_dispatch`, runs exactly one `anthropics/claude-code-base-action@beta` invocation, and contains no `claude-code-base-action` steps for apply/simplify/review/build/archive/promote.
- [x] 4.2 Move `.github/workflows/ci-implementation.yml` to `.github/workflows/cd-implementation.yml` using `git mv` so history is preserved.
- [x] 4.3 Rewrite `cd-implementation.yml` to the thin-wrapper form: triggers (`push` + `workflow_dispatch`), single job, checkout (`fetch-depth: 0`), node setup, install `@fission-ai/openspec` and root backend deps, derive `<change-name>` from `GITHUB_REF` (with leading-issue-id stripping), call `claude-code-base-action@beta` once with the orchestrator skill and `<owner/repo> <change-name>` as the positional args; expose `GH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`.
- [x] 4.4 Remove the `promote` job that previously created `feature/<name>` and opened the PR — its logic now lives in pipeline step 7.
- [x] 4.5 Update `.github/workflows/cd-proposal-promote.yml` so any `gh workflow run` invocation referencing `ci-implementation.yml` now references `cd-implementation.yml`.
- [x] 4.6 Verify the workflow-shape test from 4.1 passes.

## 5. Pipeline smoke / dry-run

- [x] 5.1 Write an end-to-end dry-run script under the skill fixtures (or a small bash harness) that invokes the orchestrator skill against `fixtures/sample-change/` and asserts: stage-skip detection works (re-running after a partial pipeline does not re-do completed stages), the `ERROR:` failure convention is detected, the TDD-bounce cap is enforced (mocked), and the build-attempt budget is enforced (mocked).
- [x] 5.2 Run the dry-run script locally; capture and address any contract gaps in the SKILL.md or agent bodies.
- [x] 5.3 Document the local dry-run command in the skill body (`/cd-implementation-pipeline <owner/repo> <name>`).

## 6. Verification

- [x] 6.1 `openspec validate multi-agent-implementation-pipeline --strict` passes.
- [x] 6.2 Run the existing repo CI lints (if any) on the renamed workflow.
- [ ] 6.3 Dispatch the renamed `cd-implementation.yml` on a real `implementation/<name>` branch (or via `workflow_dispatch`) and observe the orchestrator drive all seven steps to a green run, producing the expected commits (`feat: apply`, optionally `refactor: simplify`, `fix: review fixes`, optionally `fix: build failures`, `chore: archive`) and the renamed `feature/<name>` branch with an open PR to `develop`. _(deferred — requires live CI run with secrets)_
- [ ] 6.4 Confirm `cd-proposal-promote.yml`'s dispatch of `cd-implementation.yml` still wires correctly end-to-end by promoting a real proposal PR through to an opened implementation PR. _(deferred — requires end-to-end proposal+implementation run)_
