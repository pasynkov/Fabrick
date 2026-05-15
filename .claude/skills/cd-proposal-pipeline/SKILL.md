---
name: cd-proposal-pipeline
description: Orchestrate the end-to-end proposal pipeline from a GitHub issue labelled "proposal:ready" through opened PRs. Invokes four custom subagents (gh-ops, proposal-author, proposal-reviewer, git-ops) across six sequential steps, with parallel review fan-out in step 4 and a per-step retry budget. Use when the CI workflow cd-proposal-create.yml triggers, or locally to dry-run the pipeline against a real issue.
license: MIT
metadata:
  author: pasynkov
  version: "1.0"
---

You orchestrate the proposal pipeline. Your prompt MUST supply two positional arguments:

```
/cd-proposal-pipeline <owner/name> <issue-number>
```

The skill is caller-agnostic — CI fills the arguments from workflow context; a developer types them in a local Claude Code session. There is no fork in behaviour by caller.

## State and tools

- Model: opus (this orchestrator runs on Claude Opus 4.7; subagents pick their own).
- Available tools: `Agent`, `Bash`, `Read`, `Write`, `Edit`, `Skill`, `Glob`, `LS`.
- Env vars expected to be present: `GH_TOKEN` (used by `gh-ops`), `CLAUDE_CODE_OAUTH_TOKEN` (used by the action). They are inherited by every subagent automatically.
- State flows through subagent return values and the local filesystem (the `openspec/changes/<name>/` tree). Do NOT write `/tmp/*.md` or `/tmp/*.json` to pass text state between steps — pass it inline through prompts.

## Pipeline steps

The six steps run sequentially. Step 4 fans out N parallel `Agent` calls in a single response.

### Step 0 — Fetch issue thread + swap entry labels

Invoke `gh-ops`:

```
Agent(
  subagent_type="gh-ops",
  description="Fetch issue thread and swap entry labels",
  prompt="""
Repo: <repo>. Issue: <issue-number>.

Do both, in order:
1. Fetch issue thread (`gh issue view ... --json title,body,comments`). Apply truncation rules if combined size > ~30 KB or > 50 comments — preserve the issue body, drop oldest comments first.
2. Swap entry labels: remove `proposal` and `proposal:ready` (no-op if absent), add `proposal:proposing`.

Return the issue JSON inline first (optionally with `truncated: true`), followed by a short note listing labels removed/added.
"""
)
```

Expected return: the issue JSON + label-swap note. Keep the JSON in the orchestrator's context — it is the input for step 1.

### Step 1 — Generate main proposal

Invoke `proposal-author`:

```
Agent(
  subagent_type="proposal-author",
  description="Generate main proposal",
  prompt="""
Issue thread (JSON, from step 0):
<paste-the-JSON>

Issue number: <issue-number>

Derive a kebab-case change name reflecting the final agreed scope.
Invoke the openspec-propose skill with that name and a one-paragraph distillation of the issue thread.
Return:
  CHANGE_NAME: <name>
  <summary block ≤ 15 lines, Markdown>
"""
)
```

Expected return: a line `CHANGE_NAME: <main-name>` followed by a Markdown summary. Parse both. Hold `<main-name>` and the summary block for step 2 and beyond.

The summary block MUST contain an `## Affected components` section grouped by tier (`Frontend:`, `Backend:`, `Infra:`, plus project-specific tiers like `CLI:` / `Workflows:` when relevant). Each tier line names concrete services/apps/directories — not file paths. Total ≤ 6 lines. The orchestrator reuses this section verbatim in step 2's issue comment and at the top of every step 6 PR body.

The author also writes `tasks.md` in TDD order: every behavioural task is preceded by a test task; purely mechanical tasks may carry a trailing `[no-test]` flag with a one-line rationale. Step 4's reviewer verifies this contract and inserts missing test tasks.

Timeout budget: 15 minutes. If the subagent has been running longer, treat as failure.

### Step 2 — Post summary comment

Invoke `gh-ops`:

```
Agent(
  subagent_type="gh-ops",
  description="Post summary comment",
  prompt="Repo: <repo>. Issue: <issue-number>. Post the following body as a new issue comment using --body-file: <summary-block>"
)
```

The `proposal:proposing` label was already applied in step 0.

### Step 3 — Review main + extract addons

Invoke `proposal-reviewer` in mode 3:

```
Agent(
  subagent_type="proposal-reviewer",
  description="Review main proposal and extract addons",
  prompt="""
Mode: 3 (review main + extract addons)
Main change: <main-name>
Issue number: <issue-number>

Issue thread (JSON):
<paste-the-JSON>

Invoke the review-proposal skill with `<main-name> --issue <issue-number>`.
After the skill finishes, classify capabilities as core or addon per the rule documented in your agent file. For each addon: run `openspec new change <addon>`, populate its artifacts, remove the addon content from the main change, and append a Scope note to the main proposal's Impact section.

Return on its own line:
  CHANGES: ["<main-name>", "<addon-1>", ...]
followed by a brief summary.
"""
)
```

Expected return: a line `CHANGES: [...]` (JSON array of change directory names). Parse it. The result is the input list for steps 4, 5, and 6.

Timeout budget: 20 minutes.

### Step 4 — Parallel review of every change directory

Issue ONE response containing N `Agent` tool calls — one per change directory. The orchestrator MUST batch them in a single response so they run in parallel.

Example for N=3:

```
Agent(
  subagent_type="proposal-reviewer",
  description="Review main",
  prompt="Mode: 4. Change directory: <main-name>. Invoke review-proposal skill, then verify tasks.md is TDD-ordered (every behavioural task preceded by a test task or flagged [no-test]); insert missing test tasks above the relevant implementation tasks and record insertions in the note. Write review notes ≤ 20 lines. Return prefixed REVIEW: <main-name>."
)
Agent(
  subagent_type="proposal-reviewer",
  description="Review addon-1",
  prompt="Mode: 4. Change directory: <addon-1>. Same contract: review-proposal skill + TDD check + insertions. Return REVIEW: <addon-1>."
)
Agent(
  subagent_type="proposal-reviewer",
  description="Review addon-2",
  prompt="Mode: 4. Change directory: <addon-2>. Same contract. Return REVIEW: <addon-2>."
)
```

Each reviewer is scoped to a single directory under `openspec/changes/<name>/`. Filesystem isolation is by directory contract — reviewers are forbidden from touching siblings (enforced in the agent file).

Hold the N review notes in the orchestrator's context. They are consumed by step 6.

Timeout budget per branch: 10 minutes.

### Step 5 — Branches and pushes

Invoke `git-ops`:

```
Agent(
  subagent_type="git-ops",
  description="Branch, commit, push for every change",
  prompt="""
Issue number: <issue-number>
Change directories (process in order):
  - <main-name>
  - <addon-1>
  - ...

Run the no-staging loop documented in your agent file. Continue on per-branch failure; record errors and proceed.

Return a list of (change name, branch name, commit SHA) and any ERROR entries.
"""
)
```

Expected return: a list of branches that were pushed and any failure entries.

### Step 6 — PRs + per-PR comment + label transitions

For each successfully pushed branch (in order), invoke `gh-ops` to create the PR and post the review notes. Then update issue labels.

```
For each (change, branch) from step 5:
  Agent(
    subagent_type="gh-ops",
    description="Open PR for <change>",
    prompt="""
Repo: <repo>. Base: develop. Head: <branch>. Title: "proposal: <change>".
Body file: write a body whose first block is the "Affected components" section from step 1's summary (verbatim), followed by the review notes from step 4 for <change>, then a footer line `Related: #<issue-number>`.
Use the idempotent create-or-fetch pattern. Return the PR URL.
"""
  )
  Agent(
    subagent_type="gh-ops",
    description="Label PR <change>",
    prompt="Repo: <repo>. PR: <url>. Add label <main|addon> depending on whether <change> equals <main-name>."
  )
  Agent(
    subagent_type="gh-ops",
    description="Link PR to issue Development section",
    prompt="Repo: <repo>. PR: <url>. Issue: <issue-number>. Link the PR to the issue Development section via GraphQL `linkPullRequest` mutation (does NOT add a closing keyword — the issue stays open). The linked PR's source branch appears in the same Development panel as a side effect, so no separate branch-link call is needed. Idempotent: if the link already exists, surface that fact and do not retry."
  )
```

After every PR is opened (or has been recorded as failed):

```
Agent(
  subagent_type="gh-ops",
  description="Finalise issue labels",
  prompt="""
Repo: <repo>. Issue: <issue-number>.
Fetch the current label set. Remove every label whose name starts with `proposal:`. Add the label `feature`.
Then post a final comment listing every PR URL with a one-line note per PR.
"""
)
```

## Retry contract

Max 2 attempts per step (1 initial + 1 retry). Failure detection:

- The `Agent` tool call returns an error result, OR
- The subagent's reply starts with `ERROR:` (every subagent agent file documents this convention).

On first failure, re-invoke the same subagent once with the same prompt. On second failure, follow the per-step failure path:

| Step | On final failure |
|---|---|
| 0–2 | Abort the pipeline. Issue retains its current labels — do NOT roll back. |
| 3 | Abort the pipeline. Issue retains `proposal:proposing`. |
| 4 (per-branch) | Record a placeholder review note (`REVIEW: <name>\nFailed to review automatically.`) and continue with the remaining steps. |
| 5 (per-branch) | Continue with the remaining change directories. Step 6 only operates on branches that pushed successfully. |
| 6 (per-PR) | Continue with the remaining PRs. The final issue comment lists every PR that opened plus a note about any that failed. |

## Label transitions (summary)

| When | Issue labels | PR labels |
|---|---|---|
| End of step 0 | + `proposal:proposing`<br>− `proposal`, `proposal:ready` (no-op if absent) | — |
| End of step 6 | + `feature`<br>− every `proposal:*` label (`proposal:proposing`, `proposal:exploring`, `proposal:ready`, plus any legacy `proposal:*` label still attached) | main PR: `main`<br>addon PRs: `addon` |

## Issue-thread truncation (recap)

Threshold is provisional: combined body + comments > 30 KB OR comment count > 50. When triggered:

- Preserve the issue body verbatim.
- Drop the oldest comments first.
- Return JSON with `truncated: true` so subsequent steps know the input is partial.

The truncation rule is enforced inside `gh-ops` in step 0. Other steps see the post-truncation JSON.
