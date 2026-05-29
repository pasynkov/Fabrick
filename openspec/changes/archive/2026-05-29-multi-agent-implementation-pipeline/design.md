## Context

Today's `ci-implementation.yml` runs on `push` to `implementation/**` (and on workflow_dispatch from `cd-proposal-promote.yml`). It chains, in one job:
1. Branch parsing → label `implementation:apply` on the linked issue.
2. Stage skip-flags from `git log --grep`.
3. `claude-code-base-action` invocations for `openspec-apply-change`, `simplify`, `review`, `review-fix`, and (on build failure) a generic build-fix prompt.
4. Sequential builds for 6 apps with a single retry pass.
5. `claude-code-base-action` for `openspec-archive-change`.
6. A `promote` job that renames `implementation/<name>` → `feature/<name>`, opens a PR to `develop`, swaps issue labels, and comments the PR URL.

The proposal half of the loop already moved out of yaml into a multi-agent orchestrator skill (`cd-proposal-pipeline`) with four subagents (`gh-ops`, `git-ops`, `proposal-author`, `proposal-reviewer`) and an Opus orchestrator. The implementation half is the only remaining monolithic yaml, and it must catch up.

Constraints:
- We must preserve idempotent stage-skipping so that a re-run on the same branch does not redo committed stages.
- The pipeline must work both in CI (push trigger) and as a local dry-run (a developer typing `/cd-implementation-pipeline <repo> <name>` in Claude Code).
- The promote step rewrites the branch name, so the orchestrator's own checkout becomes stale after step 7. Step 7 is therefore terminal.
- We keep tests bounded: only `applications/backend/api` e2e is the gate. Non-api unit tests are not part of this change.
- Agents must not write `.github/workflows/`. Build configs (`package.json`, `tsconfig.json`, build YAMLs) are off-limits to the build-fixer.

## Goals / Non-Goals

**Goals:**
- Replace `ci-implementation.yml` with a thin wrapper (`cd-implementation.yml`) that invokes a single orchestrator skill via `claude-code-base-action`.
- Define the orchestrator skill `cd-implementation-pipeline` with a 7-step contract and document each step's subagent, model, inputs, outputs, and failure handling.
- Add five new subagent definitions with frontmatter declaring model and allowed tools, and bodies that document tool/test/file boundaries per role.
- Adopt the unified argv `<owner/repo> <change-name>` for both CI and local invocation.
- Make doer agents own their commits (no centralised git-ops commit step), reserving `git-ops` for branch ops, push, and promote rename.
- Build the per-step retry policy, the build-attempt budget (3), and the TDD bounce policy (1 bounce max) into the orchestrator.

**Non-Goals:**
- Adding unit-test runs for non-api apps in the build gate.
- Parallelising apply/simplify/reviewer — they remain sequential.
- Changing the e2e framework or its scope.
- Touching `cd-proposal-pipeline` or its subagents.
- Reworking how the proposal pipeline hands off to the implementation pipeline beyond the workflow file rename.

## Decisions

### Five doer subagents instead of one big "implementer"
Each doer wraps one existing skill and one role contract (test edits, file-scope limits, commit message). Splitting along that line matches the proposal pipeline's pattern (`proposal-author` vs `proposal-reviewer`), keeps each agent's system prompt focused, and lets each role declare its own model and tools.

**Alternative considered:** a single `implementer` agent that runs apply → simplify → review → archive in one long session. Rejected because (a) it collapses the stage-skip contract that powers re-runs, (b) it makes role-specific constraints (test edits, build configs) harder to enforce, and (c) it produces one massive commit per run instead of one commit per stage.

### Doer agents commit their own work
Each doer runs `git add -A && git commit -m "<msg> <name>"` after its task. The orchestrator does not aggregate diffs across stages.

**Alternative considered:** route every commit through `git-ops` (as the proposal pipeline does). Rejected because the implementation pipeline produces 4–5 commits per run; bouncing each through a separate subagent doubles the round trips. Doers already have to run tests/builds locally to validate their work, so granting them `Bash` for git is a small marginal scope expansion.

### Orchestrator does not validate doer work
The orchestrator reads a short summary from each doer and moves on. There is no diff inspection, no test re-run, no read of the produced files.

**Alternative considered:** orchestrator validates after each doer (re-runs e2e, greps diff for forbidden paths). Rejected because (a) doers already self-gate (they run their own tests), and (b) validating in the orchestrator doubles the work and breaks the "thin orchestrator, fat doers" contract from the proposal pipeline.

**Trade-off:** an under-tested doer can produce a bad commit that only the next step's e2e catches. Acceptable — that's the same risk as the current yaml.

### Failure signal: `ERROR:` prefix
A doer signals an unrecoverable error by starting its reply with `ERROR:`. Anything else is treated as success. This mirrors the proposal pipeline's contract.

### TDD bounce policy
If `reviewer` returns `ERROR: TDD gap on <task-refs>`, the orchestrator re-spawns `change-applier` with the gap hint, then re-runs `reviewer`. Maximum one bounce per pipeline run. A second unresolved gap is logged into the final PR comment as "TDD gap unresolved" and the pipeline proceeds.

**Alternative considered:** unlimited bounces until reviewer is satisfied. Rejected because reviewer disagreements that don't resolve in one pass are almost always design ambiguities that need a human, not more agent cycles.

### Build gate: parallel calls in one orchestrator response
For step 4 the orchestrator issues 6 `Bash` tool calls in a single response — one per app. The harness executes them in parallel. If any fail, the orchestrator calls `build-fixer` with the failure dump.

**Alternative considered:** dispatch a single `build-runner` subagent that runs builds internally. Rejected because (a) builds have no model logic, just `npm run build`, and (b) parallelism is easier when the orchestrator owns the calls directly.

### Build attempt budget = 3
Counted as: 1 initial parallel build run + up to 2 build-fixer iterations. After 3 attempts that still leave any build red, the orchestrator commits whatever the fixer produced (if anything), flags `partial-red`, and continues to archive. The PR opened in step 7 includes the `partial-red` flag in its body.

**Alternative considered:** abort on build failure. Rejected because partial-red is still mergeable for non-blocking apps (e.g. landing-only failure); a human can pick up.

### Stage-skip strategy: commit-msg grep + archive dir check
- `apply_done` ← `git log --grep="^feat: apply <name>$"`
- `simplify_done` ← `git log --grep="^refactor: simplify <name>$"`
- `review_done` ← `git log --grep="^fix: review fixes for <name>$"`
- `archive_done` ← `openspec/changes/archive/*-<name>` directory exists

Archive uses dir presence rather than commit message because the archive commit message may vary slightly across runs and the dir is the authoritative artifact.

### Workflow rename + thin wrapper
`ci-implementation.yml` becomes `cd-implementation.yml`. The new file:
- Triggers: `on: push: branches: ['implementation/**']` and `on: workflow_dispatch`.
- One job. Steps: checkout (full history), setup node 24, install `@fission-ai/openspec`, install root backend deps (`npm ci --legacy-peer-deps`), invoke `anthropics/claude-code-base-action@beta` with the orchestrator skill and `<repo> <name>` as positional args.
- No more in-yaml apply/simplify/review/build/archive/promote steps.

The `promote` job is removed; promotion folds into the pipeline as step 7.

**`cd-proposal-promote.yml`:** if it currently dispatches `ci-implementation.yml` by name, update the dispatch target to `cd-implementation.yml`. The trigger contract is preserved.

### Unified argv `<owner/repo> <change-name>`
- CI: an early shell step derives `<name>` from `${GITHUB_REF#refs/heads/implementation/}`, strips a leading numeric `<issue>-` prefix when the exact directory does not exist, and passes both args to the orchestrator.
- Local: developer passes `<owner/repo> <name>` directly. The orchestrator builds the branch name internally as `implementation/<name>` (or whatever already exists on `HEAD`) and refuses to switch branches.

### Tool / file boundaries per agent

| Agent | Tools | Touch impl? | Touch tests? | Touch configs? | Touch workflows? |
|---|---|---|---|---|---|
| change-applier | Bash, Read, Write, Edit, Skill | yes | yes (add + modify e2e) | no | no |
| simplifier | Bash, Read, Write, Edit, Skill | yes | no | no | no |
| reviewer | Bash, Read, Write, Edit, Skill | yes | no | no | no |
| build-fixer | Bash, Read, Write, Edit, Skill | yes | yes (minor) | no | no |
| archiver | Bash, Read, Write, Edit, Skill | no (only `openspec/changes/`) | no | no | no |

Doers MUST NOT use the `Agent` tool (no recursion) and MUST NOT shell out to `gh` (label/comment ops belong to `gh-ops`). They MAY use `Skill` to invoke the wrapped skill.

## Risks / Trade-offs

- **Doer over-reach.** A doer could ignore its file boundaries and touch e.g. `.github/workflows/`. Mitigation: the agent body documents the boundary, and reviewer/PR review catches it. A future change can add a workflow-level path filter, out of scope here.
- **Test regressions slip past stages.** A simplifier or reviewer that breaks behaviour passes the e2e gate but the build-fixer or archive doesn't catch it. Mitigation: e2e is the gate at every stage. Beyond that — same as today.
- **TDD bounce false positives.** Reviewer may flag a TDD gap on a task where tests already exist but are mis-located. Mitigation: bounce is capped at 1; the gap surfaces in the PR comment for human review.
- **Build attempt cost.** Three attempts at 6 parallel builds can be costly when always re-running greens. Mitigation: build-fixer's prompt lists only failed apps for the re-run, but the parallel orchestrator call still touches all six. Acceptable for now; a future change could re-run only failed apps.
- **Re-run on a half-archived branch.** If a pipeline run dies after `chore: archive <name>` is committed but before push, the next run sees the archive dir and skips step 5. Then step 6 pushes whatever's local. Acceptable — the same yaml has the same property today.
- **Promote rename breaks orchestrator.** Step 7 renames the branch; the orchestrator's checkout is the old name. We accept this — step 7 is the last step; nothing runs after.
- **Local dry-run drift.** A doer can behave differently locally (no CI env vars, different node version). Mitigation: fixtures include a sample change tree to exercise the path; the skill body lists the env vars each agent expects.
- **Agent count.** Adding 5 new agents takes us from 4 to 9 in `.claude/agents/`. Mitigation: each agent body is short and follows the proposal pipeline's existing format; no shared base class needed.

## Open Questions

- Should `build-fixer` get the option to mark an app as "skip-this-app" (e.g. landing always fails on the runner due to a known infra reason) rather than retry? Defer until we see the first such case.
- Do we want a per-stage timeout in addition to the global workflow timeout? The proposal pipeline uses per-step soft timeouts in the skill body — we'll mirror that here. Concrete numbers to set in the SKILL.md draft (open for tuning).
- The current yaml allows `npm install --legacy-peer-deps` in places; the new workflow should standardise on `npm ci --legacy-peer-deps` where lockfiles exist. Confirm with the first dry-run before locking.
