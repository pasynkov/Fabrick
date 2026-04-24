## Context

Current SDLC starts at `proposal/**` branch. There's no automated path from GitHub issue to that branch. Engineers either create branches manually or skip the issue phase entirely. This change adds two GH Actions workflows that bridge the gap: one for AI-assisted exploration in issue comments, one for generating proposal artifacts when ready.

Existing infrastructure:
- `ci-proposal-review.yml` — fires on `proposal/**` push, runs AI review, opens PR
- `cd-proposal-promote.yml` — fires on PR merge to develop, creates `implementation/<name>` branch
- `anthropics/claude-code-base-action@beta` — already used, `CLAUDE_CODE_OAUTH_TOKEN` secret present
- `@fission-ai/openspec` — installed globally (`npm install -g @fission-ai/openspec`), used by skills. **Not installed in existing workflows** — must be added explicitly in new workflows.

## Goals / Non-Goals

**Goals:**
- Automate explore dialogue in GitHub issue comments using `claude-code-base-action`
- Generate OpenSpec proposal artifacts + push `proposal/<name>` branch when `proposal:ready` label added
- Commit message on proposal branch references the source issue (`refs #<N>`)
- Labels reflect current stage: `proposal:exploring` → `proposal:ready`

**Non-Goals:**
- `proposal:implementing` and `proposal:released` lifecycle stages (future work)
- Editing or deleting issue comments posted by bot
- Supporting issues without `proposal` label in explore workflow

## Decisions

### D1: Two separate workflow files vs one

**Decision**: Two files — `ci-proposal-explore.yml` and `cd-proposal-create.yml`.

**Rationale**: Separate concerns. Explore workflow fires frequently (every comment); create workflow fires once. Easier to reason about permissions and failure modes independently.

### D2: Bot comment filtering

**Decision**: Filter `issue_comment` trigger by checking `github.actor` against known bot accounts (`github-actions[bot]`, `claude[bot]`).

**Rationale**: Without filtering, Claude's comment triggers another Claude run — infinite loop. GitHub Actions expressions support this via `if: github.actor != 'github-actions[bot]'`.

**Alternative considered**: Check for bot suffix `[bot]` in actor name. More general but may filter legitimate bot interactions. Specific check is safer.

### D3: Full thread as prompt context

**Decision**: Fetch full issue thread via `gh issue view <N> --json body,comments` and pass as text to Claude prompt.

**Rationale**: `claude-code-base-action` doesn't maintain session state between runs. Full thread in prompt reconstructs conversation context. Issue threads are short enough that token cost is negligible.

### D4: Proposal name derivation

**Decision**: Claude derives the kebab-case name from the issue title and discussion during the `cd-proposal-create` run.

**Rationale**: Claude has full context of what was discussed. Slug from issue title alone may be misleading if the discussion evolved the scope.

### D5: Issue label management

**Decision**: Workflows manage labels via `gh issue edit --add-label` / `--remove-label`.

**Rationale**: Simple, no extra dependencies. `issues: write` permission required in both workflows.

## Risks / Trade-offs

- **`@fission-ai/openspec` not installed in runner** → skills fail silently. Mitigation: explicit `npm install -g @fission-ai/openspec` step before `claude-code-base-action` in both workflows. Also affects existing `ci-proposal-review.yml` — tracked separately.
- **Concurrent comment storm** → multiple parallel Claude runs on same issue. Mitigation: `concurrency` group per issue number in workflow YAML, `cancel-in-progress: true`.
- **claude-code-base-action has no skill support yet** → needs `Skill` tool available. Already used in `ci-proposal-review.yml`, so precedent exists. Risk: action version changes. Mitigation: pin to `@beta` same as existing.
- **git push from GH Action requires write perms** → `contents: write` in `cd-proposal-create.yml`. Standard for this repo (see `cd-proposal-promote.yml`).
- **Proposal branch push triggers `ci-proposal-review`** → intentional and desired.
