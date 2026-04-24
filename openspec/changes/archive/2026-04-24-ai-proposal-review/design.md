## Context

Branch naming:
- `proposal/<name>` — developer works here, commits OpenSpec artifacts
- `implementation/<name>` — promoted branch, ready for implementation

Required OpenSpec artifacts per change:
- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/tasks.md`

Authentication: `CLAUDE_CODE_OAUTH_TOKEN` (Pro/Max subscription, generated via `claude setup-token`). No separate API billing.

Model: `claude-haiku-4-5-20251001` — cheap, fast, sufficient for file checks.

## Goals / Non-Goals

**Goals:**
- Validate OpenSpec artifact completeness on every push to `proposal/**`
- Promote passing branch to `implementation/<name>`, delete `proposal/<name>`
- Use real Claude Code in CI via `claude-code-action@v1`
- Fail gracefully when artifacts are missing (list what's missing)

**Non-Goals:**
- Content validation (future change)
- PR creation after promote (future change)
- Blocking push (not possible with push trigger)

## Decisions

### claude-code-action@v1 in automation mode

When `prompt` is provided, the action runs without `@claude` mention. Claude Code has access to local `.claude/skills/` from the checked-out repo, so the `review-proposal` skill is available via the Skill tool.

### exit 1 as failure signal

The skill runs `Bash("exit 1")` on failure. This causes the `review` job to fail, which blocks the `promote` job (`needs: [review]`). No additional output parsing needed.

### Branch promotion via git push + delete

```bash
git checkout -b "implementation/$NAME"
git push origin "implementation/$NAME"
git push origin --delete "proposal/$NAME"
```

Promotion job needs `contents: write` permission.

---

## Workflow Design

### ci-proposal-review.yml

```yaml
name: AI Proposal Review

on:
  push:
    branches: ['proposal/**']

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Extract change name
        id: name
        run: |
          BRANCH="${GITHUB_REF#refs/heads/}"
          NAME="${BRANCH#proposal/}"
          echo "name=$NAME" >> $GITHUB_OUTPUT
      - name: Review proposal
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          settings: |
            { "model": "claude-haiku-4-5-20251001" }
          prompt: |
            Use the Skill tool to invoke the "review-proposal" skill
            with args "${{ steps.name.outputs.name }}".

  promote:
    needs: [review]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Promote to implementation branch
        run: |
          BRANCH="${GITHUB_REF#refs/heads/}"
          NAME="${BRANCH#proposal/}"
          git checkout -b "implementation/$NAME"
          git push origin "implementation/$NAME"
          git push origin --delete "proposal/$NAME"
```

### review-proposal skill

```markdown
Check that the OpenSpec change exists and has all required artifacts.

Input: change name (e.g. "my-feature")

Steps:
1. Check for openspec/changes/<name>/proposal.md
2. Check for openspec/changes/<name>/design.md
3. Check for openspec/changes/<name>/tasks.md

If all present: output "✓ Proposal <name> is ready for implementation"
If any missing: list missing files, then run Bash `exit 1`
```
