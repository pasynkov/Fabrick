# Implementation Tasks

## Skills

- [x] Create `.claude/skills/simplify/SKILL.md`
  - Prompt-file skill (no frontmatter model, runs as main agent in CI)
  - Get changed files: `git diff --name-only HEAD`, filter test/config/openspec files
  - Apply DRY: extract duplicated logic (3+ uses), remove copy-paste patterns
  - Reduce nesting and complexity, remove dead code introduced by this change
  - Follow CLAUDE.md guidelines; never change exports/interfaces
  - Base on `claude-plugins-official/code-simplifier` agent content (already at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-simplifier/agents/code-simplifier.md`)

- [x] Create `.claude/skills/review/SKILL.md`
  - Get changed files: `git diff --name-only HEAD`, filter test/config/openspec files
  - Check each file for: bugs, dead code (from this diff), security issues, bottlenecks (N+1, sync blocks)
  - Write findings to `/tmp/review-output.md` in structured format (see design.md)
  - If no issues: write "No issues found" and exit
  - Never modify source files — output only

- [x] Create `.claude/skills/review-fix/SKILL.md`
  - Read `/tmp/review-output.md`; exit immediately if "No issues found"
  - For each issue: locate file+line, verify still present, apply minimal surgical fix
  - Skip test files; skip if fix is ambiguous
  - Never modify `.github/workflows/` files

## CI Workflow

- [x] Update `.github/workflows/ci-implementation.yml`
  - Add postgres service container to `apply-and-archive` job (same config as `ci-e2e.yml`)
  - Add `npm ci --legacy-peer-deps` step for `applications/backend/api` (needed for e2e)
  - Add build prompt + Claude step for `simplify` (between apply and archive)
  - Add build prompt + Claude step for `review`
  - Add build prompt + Claude step for `review-fix`
  - Add three e2e test steps (after apply, after simplify, after review-fix)
  - All new Claude steps: same `allowed_tools` and `permissions` as existing apply step
  - All new Claude steps: add constraints — no git commands, no test file edits, no workflow edits
