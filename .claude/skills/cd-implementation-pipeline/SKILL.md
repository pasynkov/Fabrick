---
name: cd-implementation-pipeline
description: Orchestrate the end-to-end implementation pipeline from an implementation/<name> branch through a feature/<name> branch with an open PR to develop. Invokes seven subagents (gh-ops, change-applier, simplifier, reviewer, build-fixer, archiver, git-ops) across seven sequential steps, with a parallel build gate in step 4, a per-step retry budget, a build-attempt budget of 3, and a one-bounce TDD policy. Use when the CI workflow cd-implementation.yml triggers, or locally to drive a real change directory to PR readiness.
license: MIT
metadata:
  author: pasynkov
  version: "1.0"
---

You orchestrate the implementation pipeline. Your prompt MUST supply two positional arguments:

```
/cd-implementation-pipeline <owner/name> <change-name>
```

The skill is caller-agnostic — CI fills the arguments from workflow context; a developer types them in a local Claude Code session. There is no fork in behaviour by caller.

## State and tools

- Model: opus (this orchestrator runs on Claude Opus 4.7; subagents pick their own).
- Available tools: `Agent`, `Bash`, `Read`, `Write`, `Edit`, `Skill`, `Glob`, `LS`.
- Env vars expected to be present: `GH_TOKEN` (used by `gh-ops`), `CLAUDE_CODE_OAUTH_TOKEN` (used by the action). They are inherited by every subagent automatically.
- State flows through subagent return values and the local filesystem (the `openspec/changes/<name>/` tree, the working tree, the local git log). Do NOT write `/tmp/*.md` or `/tmp/*.json` to pass text state between steps — pass it inline through prompts.
- You operate on the currently checked-out branch. You MUST NOT switch branches yourself; only `git-ops` does that in step 7.

## State derivation (run once at the start)

Parse from argv and the working tree:

```bash
NAME="<change-name>"              # from second positional arg
# Optional issue id from a leading numeric prefix on the change name
ISSUE=$(echo "$NAME" | grep -oE '^[0-9]+' || true)

# Stage-skip flags
git log --oneline | grep -qF "feat: apply $NAME"            && APPLY_DONE=true    || APPLY_DONE=false
git log --oneline | grep -qF "refactor: simplify $NAME"     && SIMPLIFY_DONE=true || SIMPLIFY_DONE=false
git log --oneline | grep -qF "fix: review fixes for $NAME"  && REVIEW_DONE=true   || REVIEW_DONE=false

# Archive skip: directory presence, not commit message
if compgen -G "openspec/changes/archive/*-$NAME" > /dev/null; then
  ARCHIVE_DONE=true
else
  ARCHIVE_DONE=false
fi
```

Use the flags to decide whether to invoke steps 1, 2, 3, and 5. Always invoke steps 0, 4, 6, and 7.

If `openspec/changes/<NAME>/` does not exist AND `ARCHIVE_DONE=false`, abort the pipeline with a clear failure result — there is nothing to implement.

## Pipeline steps

The seven steps run sequentially. Step 4 fans out 6 parallel `Bash` tool calls in one response.

### Step 0 — gh-ops: label issue implementation:apply

Skip when `$ISSUE` is empty.

```
Agent(
  subagent_type="gh-ops",
  description="Label issue implementation:apply",
  prompt="""
Repo: <repo>. Issue: <ISSUE>.
Add label `implementation:apply`. This is idempotent — if the label is already present, surface that and do not retry.
"""
)
```

### Step 1 — change-applier

Skip when `$APPLY_DONE=true`.

```
Agent(
  subagent_type="change-applier",
  description="Apply OpenSpec change <name>",
  prompt="Change name: <NAME>. Implement the change on the current branch following your agent contract. Commit `feat: apply <NAME>` when done."
)
```

The applier runs `openspec-apply-change`, may add or modify e2e tests, runs the api e2e suite to green, and commits its work. It MUST NOT push.

### Step 2 — simplifier

Skip when `$SIMPLIFY_DONE=true`.

```
Agent(
  subagent_type="simplifier",
  description="Simplify implementation for <name>",
  prompt="Change name: <NAME>. Simplify per your agent contract. No test edits. Commit `refactor: simplify <NAME>` when done."
)
```

### Step 3 — reviewer

Skip when `$REVIEW_DONE=true`.

```
Agent(
  subagent_type="reviewer",
  description="Review implementation for <name>",
  prompt="Change name: <NAME>. Run review then review-fix, validate TDD coverage of the applier's commit per your contract. Commit `fix: review fixes for <NAME>` when done."
)
```

#### TDD-bounce policy

If the reviewer returns a reply that starts with `ERROR: TDD gap on <task-refs>`:

1. Re-invoke `change-applier` once with a prompt that includes the gap hint:
   ```
   Agent(
     subagent_type="change-applier",
     description="Apply TDD-gap fix for <name>",
     prompt="Change name: <NAME>. TDD gap reported by reviewer: <task-refs>. Add the missing tests and any implementation needed to make them pass. Commit `feat: apply <NAME>` if there is a fresh commit; otherwise amend the summary noting the TDD coverage added."
   )
   ```
2. Re-invoke the reviewer.
3. **At most one bounce per pipeline run.** If the second-pass reviewer still returns `ERROR: TDD gap`, record `TDD gap unresolved: <task-refs>` in the orchestrator's working notes (to surface in step 7's PR body) and proceed to step 4 without further bounces.

A reviewer crash (subagent error, timeout) is NOT a TDD signal — handle via the per-step retry policy below.

### Step 4 — parallel build gate

Always run. Issue ONE response with SIX `Bash` tool calls — one per app — to build them in parallel:

```
Bash("cd applications/backend/api && npm run build")
Bash("cd applications/backend/synthesis && npm run build")
Bash("cd applications/console && VITE_API_URL=https://api.fabrick.me npm run build")
Bash("cd applications/landing && npm run build")
Bash("cd applications/cli && npm run build")
Bash("cd applications/mcp && npm run build")
```

Collect exit codes and output. If any failed:

```
Agent(
  subagent_type="build-fixer",
  description="Fix build failures for <name>",
  prompt="""
Change name: <NAME>.
Failed apps (with the exact build commands and error output):
  - <app-name>: <command>
    <error excerpt>
  - ...
Fix source code per your contract; re-run only the failing apps; commit `fix: build failures for <NAME>`.
"""
)
```

After `build-fixer` returns, re-run the same 6 parallel builds.

#### Build-attempt budget — 3 attempts

Total build attempts across the step MUST NOT exceed 3 (1 initial parallel run + up to 2 build-fixer iterations). If the third attempt still leaves any build red:

- Record `partial-red: <failed apps>` in the orchestrator's working notes (to surface in step 7's PR body).
- Proceed to step 5.

The build-fixer is the only doer invoked from step 4 and is the only doer that runs more than once per pipeline.

### Step 5 — archiver

Skip when `$ARCHIVE_DONE=true`.

```
Agent(
  subagent_type="archiver",
  description="Archive OpenSpec change <name>",
  prompt="Change name: <NAME>. Run openspec-archive-change non-interactively per your contract. Commit `chore: archive <NAME>` when done."
)
```

### Step 6 — git-ops: push implementation branch

Always run.

```
Agent(
  subagent_type="git-ops",
  description="Push implementation branch",
  prompt="Branch: implementation/<NAME>. Push the current branch to origin. Do not create new branches. Return the current commit SHA after push."
)
```

### Step 7 — promoter: rename to feature, open PR, label issue, comment

Always run. Two sub-invocations.

First, `git-ops` renames + pushes:

```
Agent(
  subagent_type="git-ops",
  description="Promote implementation/<name> to feature/<name>",
  prompt="""
Source branch: implementation/<NAME>. Target branch: feature/<NAME>.
1. Create feature/<NAME> from the current tip of implementation/<NAME>.
2. Push feature/<NAME> to origin.
3. Delete implementation/<NAME> on origin (`git push origin --delete implementation/<NAME>`).
Return the new branch name and the commit SHA.
"""
)
```

Then, `gh-ops` opens the PR + comments the issue:

```
Agent(
  subagent_type="gh-ops",
  description="Open PR feature/<name> → develop and update issue",
  prompt="""
Repo: <repo>. Base: develop. Head: feature/<NAME>. Title: "<NAME>".
Body: a one-line "Implementation complete." followed by:
  - the `partial-red: <apps>` note if the orchestrator recorded one in step 4 (otherwise omit)
  - the `TDD gap unresolved: <task-refs>` note if the orchestrator recorded one in step 3 (otherwise omit)
  - footer line `Related: #<ISSUE>` (only when <ISSUE> is non-empty)
Use the idempotent create-or-fetch pattern. Return the PR URL.

After the PR is open and only when <ISSUE> is non-empty:
  - Remove label `implementation:apply` from issue <ISSUE> (idempotent).
  - Add label `implementation:ready` to issue <ISSUE> (idempotent).
  - Post an issue comment containing the PR URL on a single line.
"""
)
```

When `$ISSUE` is empty, skip the label/comment operations — branch rename and PR open still run.

## Per-step retry policy

Each step is attempted at most twice (one initial attempt plus one retry on failure). Failure detection:

- The `Agent` tool call returns an error result, OR
- The subagent's reply starts with the literal token `ERROR:` (the TDD-gap variant in step 3 is handled by the bounce policy above, not by the retry policy).

After the second failed attempt:

| Step | On final failure |
|---|---|
| 0 gh-ops label | warn and continue. Issue may stay without `implementation:apply`. |
| 1 change-applier | **ABORT** the pipeline. The job exits non-zero. |
| 2 simplifier | warn and continue. No `refactor: simplify` commit on the branch. |
| 3 reviewer (crash, not TDD signal) | **ABORT** the pipeline. |
| 4 build (within 3-attempt budget) | record `partial-red`, continue. |
| 5 archiver | **ABORT** the pipeline. No promote runs. |
| 6 git-ops push | **ABORT** the pipeline. |
| 7 promoter | warn and continue. Branch may be renamed but PR not opened. |

## Doer commit contract

Doers commit their own work. The orchestrator never invokes `git commit` itself, and `git-ops` is reserved for branch operations (push, rename, delete) — not for stage commits. The expected commit subjects on the branch after a successful pipeline:

| Step | Commit subject |
|---|---|
| 1 | `feat: apply <NAME>` |
| 2 | `refactor: simplify <NAME>` (may be skipped on no-op) |
| 3 | `fix: review fixes for <NAME>` (may be skipped on no-op) |
| 4 | `fix: build failures for <NAME>` (only on build-fixer success) |
| 5 | `chore: archive <NAME>` |

## Build-attempt budget

| Attempt | What runs |
|---|---|
| 1 | 6 parallel `Bash` build calls from the orchestrator |
| 2 | `build-fixer` agent → 6 parallel build re-runs |
| 3 | `build-fixer` agent → 6 parallel build re-runs |

After attempt 3, the orchestrator records `partial-red` and moves on. The PR opened in step 7 carries the flag.

## Local dry-run

A developer can invoke the orchestrator directly:

```
/cd-implementation-pipeline <owner/repo> <change-name>
```

The orchestrator does not switch branches — the developer should already be on the `implementation/<change-name>` branch they want to drive. Stage-skip flags work locally the same as in CI: re-running the orchestrator after a partial run picks up where it left off.

For smoke tests, see `fixtures/sample-change/` and `fixtures/sample-branch.md` in this skill directory.
