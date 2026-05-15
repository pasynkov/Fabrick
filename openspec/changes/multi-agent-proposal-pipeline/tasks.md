## 1. Pre-implementation verification

- [ ] 1.1 Confirm `anthropics/claude-code-base-action@beta` honours `.claude/agents/*.md` definitions via the `Agent` tool's `subagent_type`. Run a one-off sandbox workflow or local `act` invocation that creates a trivial custom agent and verifies it is selectable.
- [ ] 1.2 Confirm the `Agent` tool's failure-result shape (error object vs error reply text) so the orchestrator's retry detection can be coded against a real signal.
- [x] 1.3 In repository settings, create the four new labels: `proposal:proposing`, `feature`, `main`, `addon`. If `proposal:pr-open` exists from earlier iterations, delete it.

## 2. Custom subagent definitions

- [x] 2.1 Create `.claude/agents/gh-ops.md` with frontmatter (`model: claude-haiku-4-5-20251001`) and tools `Bash(gh *)`, `Read`, `Write`. Body documents: fetch issue thread (with truncation rules from spec), post comments, add/remove labels. Every `gh` invocation MUST include `--repo <repo>` with the slug supplied in the agent's prompt. Forbid any non-`gh` shell calls.
- [x] 2.2 Create `.claude/agents/git-ops.md` with frontmatter (`model: claude-haiku-4-5-20251001`) and tools `Bash(git *)`, `Read`. Body documents the no-staging branch loop. Forbid `gh` and any mutation outside `openspec/changes/`.
- [x] 2.3 Create `.claude/agents/proposal-author.md` with frontmatter (`model: claude-opus-4-7`) and tools `Skill`, `Bash`, `Read`, `Write`, `Edit`. Body instructs invocation of the `openspec-propose` skill with a kebab-case change name derived from the issue thread.
- [x] 2.4 Create `.claude/agents/proposal-reviewer.md` with frontmatter (`model: claude-sonnet-4-6`) and tools `Skill`, `Read`, `Edit`, `Write`, `Bash(gh *)`, `Bash(rm -rf openspec/*)`. Body covers both step 3 (review main + extract addons) and step 4 (review one directory) modes; the orchestrator's prompt selects the mode.

## 3. Orchestrator skill

- [x] 3.1 Create `.claude/skills/cd-proposal-pipeline/SKILL.md` with frontmatter (name, description, trigger conditions inside CI). Document the input contract: `<repo>` (owner/name) and `<issue-number>` as positional arguments; both forwarded to every subagent invocation.
- [x] 3.2 Document the six pipeline steps in the skill body, including each step's subagent, prompt template, expected return shape, and timeout budget.
- [x] 3.3 Document the retry contract: max 2 attempts per step; failure detection rule (from task 1.2); per-step failure paths matching Decision 4 of `design.md`.
- [x] 3.4 Document the parallel fan-out in step 4: orchestrator MUST issue N `Agent` calls in a single response. Provide an example block in the skill text.
- [x] 3.5 Document the inline-state contract: subagents return text; no `/tmp/*.md` for text state; the only filesystem handoff is `openspec/changes/<name>/`.
- [x] 3.6 Document the no-staging git loop verbatim in step 5's section so `git-ops` follows it without ambiguity.
- [x] 3.7 Document label transitions: `proposal:proposing` set in step 2; in step 6 add `feature` and remove every `proposal:*` label (`proposal:proposing`, `proposal:exploring`, `proposal:ready`); per-PR `main`/`addon` labels.
- [x] 3.8 Document the issue-thread truncation rule (provisional 30 KB / 50 comments, oldest dropped first, body preserved).

## 3a. Affected-components analysis (TDD: write failing pipeline-dry-run test then add docs)

- [x] 3a.1 Write a failing dry-run check (or expand the existing skill dry-run) that asserts `proposal-author`'s returned summary contains an `## Affected components` heading and at least one tier line (`Frontend:`, `Backend:`, `Infra:`, …). Implemented as fixture `.claude/skills/cd-proposal-pipeline/fixtures/components-summary/` (input + expected + assert).
- [x] 3a.2 Update `.claude/agents/proposal-author.md` to require the "Affected components" section in the summary block: grouped by tier (`Frontend:`, `Backend:`, `Infra:`, plus project-specific tiers when relevant), ≤ 6 lines total, naming concrete services/apps/directories — not file paths. [no-test] (doc-only edit on agent prompt).
- [x] 3a.3 Update SKILL.md so step 2 instructs `gh-ops` to post the summary verbatim, and step 6 instructs `gh-ops` to begin every PR body with the same "Affected components" section followed by the per-directory review notes. Make the dry-run check from 3a.1 pass.

## 3b. TDD task ordering (TDD: write failing reviewer-spec test then enforce)

- [x] 3b.1 Write a failing local test/fixture that asserts `proposal-reviewer` (mode 4) inserts a missing test task above an unmocked behavioural implementation task in a sample `tasks.md`. Implemented as fixture `.claude/skills/cd-proposal-pipeline/fixtures/tdd-task-insertion/` (input-tasks + expected-tasks + assert).
- [x] 3b.2 Update `.claude/agents/proposal-author.md` to require TDD-ordered `tasks.md`: every behavioural capability task MUST be preceded by a test task (unit/integration/e2e as appropriate); purely mechanical tasks MAY be suffixed `[no-test]` with a one-line rationale. [no-test] (doc-only edit on agent prompt).
- [x] 3b.3 Update `.claude/agents/proposal-reviewer.md` mode 4 to (a) verify each behavioural task is preceded by a test task or flagged `[no-test]`, (b) insert a test task immediately above any violation, (c) record the insertion in the returned review note. Make the 3b.1 fixture pass.
- [x] 3b.4 Update SKILL.md step 4 prompt example to reference the TDD-verification step inside the reviewer's responsibility.

## 4. Workflow rewrite

- [x] 4.1 Rewrite `.github/workflows/cd-proposal-create.yml` to a thin shell: trigger `issues.labeled` for `proposal:ready`; `concurrency: proposal-pipeline-${{ github.event.issue.number }}` with `cancel-in-progress: false`; permissions `issues: write`, `contents: write`, `pull-requests: write`.
- [x] 4.2 Steps: `actions/checkout@v4` (fetch-depth 0), `npm install -g @fission-ai/openspec`, then a single `anthropics/claude-code-base-action@beta` step.
- [x] 4.3 Set the action's env block: `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, `CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`.
- [x] 4.4 Set the action's `model: claude-opus-4-7`, `timeout_minutes: 45`, `allowed_tools: "Agent,Bash,Read,Write,Edit,Skill,Glob,LS"`, and a `settings` block permitting `Bash(*)`, `Read(*)`, `Write(*)`, `Edit(*)`, `Glob(*)`.
- [x] 4.5 Set the action's `prompt` to a short instruction that invokes the `cd-proposal-pipeline` skill with the repository slug (`${{ github.repository }}`) and the issue number (`${{ github.event.issue.number }}`) as positional arguments.

## 5. Removal of obsolete review workflow

- [x] 5.1 Verify no in-flight `proposal/**` branches depend on `ci-proposal-review.yml` (check open PRs and recent workflow runs).
- [x] 5.2 Delete `.github/workflows/ci-proposal-review.yml`.
