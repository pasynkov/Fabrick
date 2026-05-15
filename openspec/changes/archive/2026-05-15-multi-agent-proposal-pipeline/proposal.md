## Why

The current proposal-creation flow is split across two GitHub Actions workflows (`cd-proposal-create.yml` and `ci-proposal-review.yml`) that pass state between each other via branch pushes, intermediate files in `/tmp`, and `gh workflow run` triggers. Logic is fragmented across YAML steps and inline prompts: one workflow generates artifacts and splits addons in bash; the second runs review on every push of `proposal/**` and opens PRs. Adding a new step (e.g. per-PR review summary, label change, retry) means editing YAML in two places and reasoning about cross-workflow ordering.

Collapsing both workflows into a single multi-agent pipeline driven by an orchestrator skill removes the cross-workflow handoff, centralises the logic in one reviewable place, and makes each phase a typed subagent call with explicit model, tool, and retry budget. Step 4 (review of main + addons) can run in parallel, cutting wall-clock latency.

## What Changes

- Add a single multi-agent pipeline that runs end-to-end inside one GitHub Actions job, replacing the `cd-proposal-create` + `ci-proposal-review` two-workflow chain.
- Add an orchestrator skill `cd-proposal-pipeline` invoked once by the workflow; it sequentially calls four custom subagents (`gh-ops`, `git-ops`, `proposal-author`, `proposal-reviewer`) per step with a max of 2 attempts each (1 retry on failure).
- Add four custom subagent definitions under `.claude/agents/` with per-agent model and tool allowlists (`gh-ops`/`git-ops` on Haiku, `proposal-reviewer` on Sonnet, `proposal-author` on Opus).
- Rewrite `.github/workflows/cd-proposal-create.yml` to a thin shell: checkout, install openspec, single `claude-code-base-action` call with `GH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` env vars exposed to all subagents (Plan A — agent-direct `gh` calls).
- **BREAKING**: Delete `.github/workflows/ci-proposal-review.yml`. Review now happens inside the unified pipeline (step 4), not on `push: proposal/**`.
- Run review of main proposal and each extracted addon in parallel (multiple `Agent` calls in one orchestrator response) instead of sequentially across separate workflow runs.
- Use a no-staging git approach in step 5: untracked addon directories persist across branch switches, `git add <path>` is selective per branch — no `git stash` or `/tmp` staging needed.
- Add four new GitHub issue/PR labels: `proposal:proposing` (set on the issue after step 2), `feature` (set on the issue after step 6, replacing every `proposal:*` label), `addon` (set on addon PRs), `main` (set on main proposal PR).
- Add an affected-components analysis to `proposal-author`'s summary block (a short list naming frontends, backends, services, infra surfaces touched). The same list is reused verbatim in step 2's issue comment and in step 6's PR body.
- Enforce TDD task ordering inside the pipeline: `proposal-author` writes `tasks.md` with test-first tasks (write/modify failing test → make it pass → refactor) for every behavioural capability; `proposal-reviewer` (mode 4) verifies the ordering for each change directory and inserts missing test tasks before the related implementation tasks.
- Leave `ci-proposal-explore.yml` and `ci-proposal-trim.yml` untouched — they cover different concerns (interactive explore dialogue, mid-review PR comment edits).

## Capabilities

### New Capabilities

- `multi-agent-proposal-pipeline`: orchestrator skill structure, subagent contracts, retry semantics, parallel-review fan-out, and the thin workflow shell that invokes it.

### Modified Capabilities

- `github-issue-to-branch`: branch creation, push, and PR opening now happen inside the unified pipeline (steps 5–6) rather than via a two-workflow chain. The `Existing ci-proposal-review fires` scenario must be removed because that workflow no longer exists.
- `proposal-addon-detection`: addon detection runs as step 3 of the pipeline inside the `proposal-reviewer` subagent, no longer as a separate `Scope check` GitHub Actions step.

## Impact

- **Workflows**: `cd-proposal-create.yml` rewritten; `ci-proposal-review.yml` deleted; `ci-proposal-explore.yml` and `ci-proposal-trim.yml` untouched.
- **Skills**: new `.claude/skills/cd-proposal-pipeline/SKILL.md`; existing `openspec-propose` and `review-proposal` skills reused unchanged (now invoked by subagents).
- **Subagents**: new `.claude/agents/gh-ops.md`, `.claude/agents/git-ops.md`, `.claude/agents/proposal-author.md`, `.claude/agents/proposal-reviewer.md`.
- **Labels**: four new labels required in the GitHub repo settings — `proposal:proposing`, `feature`, `addon`, `main`. After step 6 the issue carries only `feature`; every `proposal:*` label is removed.
- **Secrets**: no change. `GITHUB_TOKEN` (built-in) and `CLAUDE_CODE_OAUTH_TOKEN` (existing secret) are reused.
- **Models / cost**: orchestrator on Opus; one Opus call per author step; Sonnet calls for each parallel review; Haiku for `gh`/`git` ops. Higher per-run token spend than the current Haiku-heavy flow, traded for higher proposal quality and lower latency.
- **Open questions** (carried into `design.md`): subagent support inside `anthropics/claude-code-base-action@beta`; retry-loop implementation in orchestrator; max issue-thread size that fits inline through subagent results.
