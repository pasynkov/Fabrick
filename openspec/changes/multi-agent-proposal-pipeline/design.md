## Context

Today, proposal creation is a two-workflow chain:

```
issue + "proposal:ready"
        │
        ▼
cd-proposal-create.yml
  ├── fetch issue thread (bash + gh)
  ├── Generate artifacts (claude-code-base-action, haiku, openspec-propose skill)
  ├── Scope check — split addons (claude-code-base-action, haiku)
  ├── Commit + push proposal/N-<main>
  ├── Comment on issue
  └── gh workflow run ci-proposal-review.yml          ─┐
                                                       │ cross-workflow
ci-proposal-review.yml (on push: proposal/**)         │ handoff
  ├── Review skill (claude-code-base-action, sonnet, review-proposal)
  ├── Commit fixes if any
  ├── gh pr create → develop
  ├── Remove labels from issue
  └── Comment PR link + report                        ─┘
```

State flows between the two workflows via three channels: pushed branches, the issue itself (labels and comments), and explicit `gh workflow run` triggers. The same review workflow also fires on every push to `proposal/**`, which means addons each spawn their own independent review run with no shared context.

The split has visible costs:

1. **Two YAML files** must stay in sync for any change to the contract (e.g. new labels, new step ordering, retries).
2. **Each phase is a separate one-shot LLM call** invoked by its own bash step. Composition between phases (e.g. "after addon split, review main and each addon") requires re-bootstrapping a Claude run.
3. **Serial review** — addons review one-at-a-time across separate workflow runs, eating wall-clock latency.
4. **Retry semantics are absent**: a transient `gh` or `git` failure aborts the run and leaves the issue in a half-labelled state.

The replacement is a single workflow that hosts one orchestrator agent (Opus). The orchestrator invokes typed subagents through the `Agent` tool — each subagent has a frozen model and tool allowlist via a definition file under `.claude/agents/`. State flows through subagent return values and the local filesystem (the `openspec/changes/<name>/` tree). The orchestrator implements retry, fan-out, and step ordering in skill text rather than YAML.

## Goals / Non-Goals

**Goals:**

- Replace `cd-proposal-create.yml` + `ci-proposal-review.yml` with a single workflow YAML that triggers on `issues.labeled` for `proposal:ready` and runs the full pipeline end-to-end.
- Centralise pipeline logic in an orchestrator skill (`.claude/skills/cd-proposal-pipeline/SKILL.md`) so future changes touch one file.
- Define four reusable subagents (`gh-ops`, `git-ops`, `proposal-author`, `proposal-reviewer`) with explicit model and tool contracts.
- Run review of the main proposal and each extracted addon **in parallel** (multiple `Agent` calls in a single orchestrator response).
- Give every step a max of 2 attempts (1 retry on transient failure) so a flaky `gh` call does not abort the whole pipeline.
- Keep `ci-proposal-explore.yml` and `ci-proposal-trim.yml` untouched. Explore is an interactive dialogue; trim operates on PR review comments mid-iteration.

**Non-Goals:**

- Replacing or modifying the `openspec-propose` skill, the `review-proposal` skill, or the existing addon-detection heuristic. The pipeline reuses them via subagent `Skill` calls.
- Touching the explore phase. The pipeline starts only after `proposal:ready` is added.
- Implementing GitHub OIDC or replacing the `GITHUB_TOKEN`-based auth. The default action token is sufficient.
- A general retry framework. Retry lives in the orchestrator skill and is hand-rolled per step.

## Decisions

### Decision 1: One workflow + orchestrator skill (over multi-step YAML)

The workflow YAML is reduced to a thin shell — checkout, install openspec, single `claude-code-base-action` invocation. The skill `cd-proposal-pipeline` performs all six pipeline steps.

```
.github/workflows/cd-proposal-create.yml
   └── claude-code-base-action (model: opus, tools: Agent, Bash, Read, Write, Edit, Skill)
       └── Skill: cd-proposal-pipeline
            ├── Agent → gh-ops      step 0  fetch issue thread
            ├── Agent → proposal-author    step 1  propose
            ├── Agent → gh-ops      step 2  comment summary + label
            ├── Agent → proposal-reviewer  step 3  review main, extract addons
            ├── Agent → proposal-reviewer (xN, parallel)   step 4  per-dir review
            ├── Agent → git-ops     step 5  branches + push
            └── Agent → gh-ops      step 6  PRs + per-PR comment + labels
```

**Alternatives considered:**

- *Multiple YAML steps each calling `claude-code-base-action`.* Each step pays the bootstrap cost (action setup, prompt scaffolding, settings JSON). Sharing state between steps requires `/tmp` files. Retry across steps is GHA-level only and requires re-running the whole workflow.
- *Two separate workflows triggered by labels (status-quo).* Already the source of the problems described in Context.

The orchestrator-skill approach gives a single conversation context for the entire run, native `Agent` fan-out for parallel review, and orchestrator-controlled retry.

### Decision 2: Custom subagents over inline `general-purpose`

Each subagent is defined in `.claude/agents/<name>.md` with frontmatter declaring its model and tool allowlist. The orchestrator invokes them via the `Agent` tool's `subagent_type` parameter.

| Agent | Model | Tools |
|---|---|---|
| `gh-ops` | `claude-haiku-4-5-20251001` | `Bash(gh *)`, `Read`, `Write` |
| `git-ops` | `claude-haiku-4-5-20251001` | `Bash(git *)`, `Read` |
| `proposal-author` | `claude-opus-4-7` | `Skill`, `Bash`, `Read`, `Write`, `Edit` |
| `proposal-reviewer` | `claude-sonnet-4-6` | `Skill`, `Read`, `Edit`, `Write`, `Bash(gh *)`, `Bash(rm -rf openspec/*)` |

**Alternatives considered:**

- *Inline `general-purpose` subagents with model and tool list crammed into every prompt.* Works, but the contract drifts: changing tools means hunting through orchestrator prompts. Custom agents centralise the contract in one md file per agent.

`claude-code-base-action@beta` is documented to honour `.claude/agents/` definitions; if it does not, the orchestrator falls back to inline prompts (carried as an Open Question, see below).

### Decision 3: Agent-direct `gh` calls (Plan A) over bash-bridge (Plan B)

`GITHUB_TOKEN` is exposed as `GH_TOKEN` env at the workflow `env:` block, so all subagents inherit it. The `gh-ops` agent calls `gh` directly via `Bash(gh *)`. Every `gh` invocation includes the `--repo <repo>` flag (where `<repo>` is the first positional argument to the skill) so the same code path works in CI and from a developer's local `gh` CLI session regardless of working-directory remote configuration.

**Alternatives considered:**

- *Plan B — agent writes `/tmp/*.md`, bash step calls `gh`.* Tighter permissions, simpler to audit, but every `gh` call becomes an extra YAML step. Loses the "one orchestrator runs the whole pipeline" property and re-introduces YAML state-passing.

Plan A is chosen for orchestration cleanliness. The trade is wider tool permissions per subagent.

### Decision 3a: Skill accepts `<repo> <issue>` positional arguments

The skill takes the repository slug and issue number as positional arguments and is caller-agnostic. CI fills them from `${{ github.repository }}` and `${{ github.event.issue.number }}`; a developer types `/cd-proposal-pipeline owner/name 123` locally. There is no fork in skill behaviour by caller. The orchestrator forwards both values to every subagent — `gh-ops` uses the slug for `gh ... --repo <repo>`; `git-ops` uses only the issue number for branch names and inherits the `origin` remote from the working tree.

**Alternatives considered:**

- *Inferring the repository from `git remote get-url origin`.* Works locally but breaks if the developer is testing against a fork or a different remote. Explicit argument is unambiguous and matches CI behaviour.

### Decision 4: Max 2 attempts per step, retry inside orchestrator

The orchestrator wraps each `Agent` call in a "try → on failure, retry once → on second failure, fail the pipeline" loop. Failure is detected by either:

- the `Agent` tool returning an error result, or
- the subagent's textual reply matching an "I cannot complete this task" or "error" pattern documented in the skill.

Failure mode contract:

- **Step 0–2 fail**: pipeline aborts. Issue keeps `proposal:ready` label. User retries by re-applying the label or re-running the workflow.
- **Step 3 fails**: pipeline aborts. Issue retains `proposal:proposing`. User must manually remove the label or rerun.
- **Step 4 fails** (any one parallel branch): the failing branch retries once; remaining branches continue. If retry fails, the pipeline records the failed review in step 6's PR comment and proceeds.
- **Step 5 fails partway** (e.g. push fails for one of three changes): the orchestrator records which branches pushed successfully and retries only the failed pushes. After retry exhaustion, pipeline aborts and step 6 only opens PRs for branches that pushed.
- **Step 6 fails partway**: orchestrator retries failed `gh pr create`/`gh issue comment` once. Successful PRs are not re-opened.

**Alternatives considered:**

- *GHA-level retry on the whole step.* Re-runs the entire pipeline — wasted tokens, re-publishes labels, duplicates comments.
- *Unlimited retry with backoff.* Risk of runaway loops within the action's `timeout_minutes` budget.

### Decision 5: Parallel review (step 4) via single-response multi-`Agent`-call

After step 3 returns the list of change directories (`["main", "addon1", "addon2", ...]`), the orchestrator issues N parallel `Agent` invocations in one response — one per directory, all `proposal-reviewer`. Filesystem isolation is guaranteed by directory: each reviewer touches only `openspec/changes/<name>/`.

**Alternatives considered:**

- *Sequential review.* Trivially correct, but linear in N. For 2–3 addons this is 3–5× the latency of parallel.
- *Single reviewer agent that loops over all directories.* Wastes the parallelism; one bad addon blocks others.

### Decision 6: No-staging git approach in step 5

When step 3 finishes, the working tree has `openspec/changes/<main>/`, `openspec/changes/<addon1>/`, … all untracked, with HEAD at `develop` (or the action's checkout ref). Step 5 runs:

```bash
for change in main addon1 addon2; do
  git checkout develop
  git checkout -b "proposal/${ISSUE}-${change}"
  git add "openspec/changes/${change}/"
  git commit -m "proposal: ${change}\n\nrefs #${ISSUE}"
  git push origin "proposal/${ISSUE}-${change}"
done
```

Untracked directories survive branch switches. `git add <path>` is selective, so each branch's commit contains only that change's directory. The remote branch is therefore clean even though the local working tree is "messy" mid-loop.

**Alternatives considered:**

- *`git stash push -u` per addon.* Atomic and auditable, but adds a stash-pop dance after each branch. CI runner is ephemeral — recovery is unnecessary.
- *`/tmp` staging (`mv ... /tmp/staging/`).* Equivalent to stash semantically but with manual file ops. Loses the property that the working tree is a single coherent git state.

No-staging wins on simplicity given the CI context.

### Decision 7: Inline state passing through subagent return values

Subagent results are returned as text into the orchestrator's conversation. The orchestrator passes them to the next subagent through prompt text. No `/tmp/*.md` files are written for *text* state.

The only filesystem state is the `openspec/changes/<name>/` tree, which subagents read/write directly.

**Alternatives considered:**

- *`/tmp/*.md` files for every handoff (status quo).* Forces every prompt to include a `read from /tmp/...` instruction, and adds cleanup steps. Inline state is shorter and stays in-context.

The risk is that very large issue threads (>>50 KB) bloat the orchestrator context. Mitigation: `gh-ops` truncates the thread JSON to the most recent N comments if the body exceeds a soft cap (TBD threshold, recorded as an Open Question).

### Decision 8: New labels for pipeline phase visibility

- `proposal:proposing` — set on the issue after step 2. Indicates "pipeline is mid-flight". Removed in step 6.
- `feature` — set on the issue in step 6 after all PRs are opened. Once PRs exist, the issue is a tracked feature request, not a proposal in progress. Every `proposal:*` label (`proposal:exploring`, `proposal:ready`, `proposal:proposing`) is removed in the same call.
- `main` (PR label) — applied to the PR for the main proposal.
- `addon` (PR label) — applied to PRs for each extracted addon.

**Alternatives considered:**

- *Keep a `proposal:pr-open` label alongside `feature`.* Two labels for one state add noise; downstream tooling that filters open feature work would need to OR both. `feature` alone is sufficient because PR existence already signals "PRs opened".
- *No new labels — rely on PR existence as signal.* Loses the "pipeline is running" visibility. If a run hangs, an external observer cannot tell whether the proposal is still being processed.

### Decision 10: Affected-components analysis in the summary

`proposal-author` produces a short "Affected components" list as part of its summary block. The list groups touched surfaces by tier (`Frontend:`, `Backend:`, `Infra:`, plus any project-specific tier such as `CLI:` or `Workflows:`) and names the concrete services/apps/directories per tier. The same list is reused verbatim:

- in step 2's issue summary comment,
- in step 6's per-PR body (alongside the per-directory review notes from step 4).

The author derives the list from the proposal scope it just generated — not from the issue thread alone — so it reflects what the proposal actually plans to touch. The list is intentionally short (target ≤ 6 lines): callers want a glance at blast radius, not a file-by-file diff prediction.

**Alternatives considered:**

- *Inline diff prediction.* Too noisy and brittle — names of files change between author run and implementation.
- *Components list only in PR body, not in issue comment.* Issue subscribers lose the same glance-value; duplicating costs nothing because both come from the same author return.

### Decision 11: TDD task ordering enforced in pipeline (not in `openspec-propose`)

The `tasks.md` for every change directory MUST list tests before implementation for each behavioural capability:

1. write or modify a failing test,
2. implement the minimum code to make it pass,
3. refactor.

Enforcement lives in two layers:

- **`proposal-author`** generates `tasks.md` in TDD order by default. Pure-mechanical edits (rename, doc-only, label-only, workflow YAML rewrites) are exempted — the author flags those tasks `[no-test]` with a one-line rationale.
- **`proposal-reviewer`** (mode 4) verifies the ordering for the change directory it owns. Where a test task is missing, the reviewer inserts it before the related implementation task. Where a task is exempted, the reviewer accepts the `[no-test]` flag if the rationale is plausible.

The check is NOT pushed into the `openspec-propose` skill because that skill is generic — other callers (manual `/opsx:propose`, future flows) may not want TDD ordering forced on them. Keeping the rule pipeline-local preserves the skill's neutrality.

**Alternatives considered:**

- *Push the rule into `openspec-propose`.* Cleaner enforcement (one place), but couples all skill callers to a TDD policy that is specific to the CI pipeline.
- *Reviewer-only enforcement.* Avoids touching the author, but forces the reviewer to rewrite tasks.md from scratch in the common case; the author can produce correct ordering on the first pass at no extra cost.

### Decision 9: Delete `ci-proposal-review.yml`

The review workflow is fully subsumed by step 4 of the pipeline. Its `workflow_dispatch` input becomes orphaned. Existing in-flight `proposal/**` branches at the time of this change's deployment still need review; the migration plan addresses this.

## Risks / Trade-offs

- **Risk: `claude-code-base-action@beta` does not honour `.claude/agents/` definitions.** → Mitigation: the orchestrator falls back to invoking `general-purpose` subagents with model and tool overrides set inline on each `Agent` call. Detection happens at implementation time during local dry-run.
- **Risk: 45-minute `timeout_minutes` budget is exceeded** on large issues (many addons + Opus author + parallel Sonnet reviews). → Mitigation: orchestrator times step 1 and steps 3–4 separately and emits a partial failure if a step exceeds an internal budget (e.g. 15 minutes for author, 20 minutes for review). Failure path matches Decision 4.
- **Risk: `GH_TOKEN` exposure to subagents.** Wider tool surface means a subagent could theoretically issue unintended `gh` calls (e.g. close issues, delete branches). → Mitigation: each subagent's allowed `Bash` patterns are restricted (`Bash(gh *)` is the widest; `git-ops` cannot call `gh` at all). Plus, the `GITHUB_TOKEN` is scoped per workflow run by GitHub Actions — it cannot delete the repo.
- **Risk: parallel reviewer agents race on filesystem.** → Mitigation: by directory contract — each `Agent` call is given `openspec/changes/<name>/` and forbidden from touching siblings. Enforced by prompt; not enforced by the filesystem itself.
- **Trade-off: higher per-run token cost.** Opus orchestrator + Opus author + multiple Sonnet reviews exceed the current Haiku-heavy cost. Justified by Decision 1 (single conversation context) and Decision 5 (parallel review wall-clock win).
- **Risk: retry doubles cost for transient failures.** Bounded by max 2 attempts per step; total worst-case cost is ≤ 2× normal.
- **Trade-off: no longer review on every `proposal/**` push.** A human pushing directly to a `proposal/*` branch no longer triggers an AI review (the trim workflow still covers in-PR comment iteration). If that path matters, restore a slimmed-down `ci-proposal-review.yml` later.

## Migration Plan

1. Land this change with **both** the new pipeline and the old `ci-proposal-review.yml` present. The old review workflow can continue handling any in-flight `proposal/**` branches that pre-date the new pipeline.
2. Verify the new pipeline with a synthetic issue: add `proposal:ready`, watch the run produce labels, branches, PRs, and per-PR comments.
3. Once verified, open a follow-up commit that deletes `.github/workflows/ci-proposal-review.yml`.
4. Update repository labels: add `proposal:proposing`, `proposal:pr-open`, `addon`, `main` (manual step — labels must exist before the workflow tries to apply them).

**Rollback:** revert the deletion of `ci-proposal-review.yml`, revert the rewrite of `cd-proposal-create.yml` to its prior contents, and (optionally) delete the new agents and skill. The `openspec-propose` and `review-proposal` skills are unchanged, so nothing else depends on the new artifacts.

## Open Questions

1. **`.claude/agents/` support inside `anthropics/claude-code-base-action@beta`.** Needs a local dry-run with `act` or a sandbox repo before merging. If unsupported, fall back per Decision 1 mitigation.
2. **Orchestrator retry implementation.** The `Agent` tool's failure signal is not fully specified — does it raise an exception, return an error result object, or echo the subagent's error reply as plain text? Implementation step verifies this and codifies the detection pattern in the skill text.
3. **Issue thread size cap.** What is the soft threshold (in characters or comment count) above which `gh-ops` should truncate? Provisional: 30 KB / 50 comments, oldest dropped first. Confirm during implementation.
4. **Concurrency of pipeline runs against the same issue.** GHA `concurrency:` group set to `proposal-pipeline-${{ issue.number }}` with `cancel-in-progress: false` so a re-labelled issue does not interrupt a running pipeline. Confirm this matches user expectation.
