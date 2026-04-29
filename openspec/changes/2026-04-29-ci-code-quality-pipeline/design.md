# CI Code Quality Pipeline Design

## Overview

Three Claude skills run sequentially inside `ci-implementation.yml`, each as a separate `claude-code-base-action` step. All three share the same working directory and filesystem (including `/tmp/`). No intermediate git commits — all changes accumulate until the final commit step.

## Shared Scope: Changed Files

All three skills use the same scope:

```bash
git diff --name-only HEAD
```

This returns uncommitted files modified in the current CI run. Since no commits happen between `apply` and the final `commit` step, this captures exactly the implementation output.

**Test file exclusion pattern** (applied by all three skills):
```
*.spec.ts
*.test.ts
*.e2e.ts
**/test/**
**/__tests__/**
```

Non-code exclusions (also skipped):
```
*.md  *.yml  *.yaml  *.json  openspec/**
```

## Skill: `simplify`

**Source**: Based on `claude-plugins-official/code-simplifier` agent, adapted for CI (headless, prompt-file mode).

**What it does**:
- Reads each changed non-test file
- Applies DRY: extracts logic used 3+ times, removes copy-paste patterns
- Reduces nesting and complexity
- Removes dead code (unreachable branches, unused vars introduced by this change)
- Consolidates related operations
- Follows CLAUDE.md coding guidelines
- Never changes external interfaces/exports

**What it does NOT do**:
- Add abstractions used once
- Add comments
- Change test files
- Change `.github/workflows/` files

## Skill: `review`

**What it does**:
- Reads each changed non-test file + surrounding context
- Identifies:
  - **Bugs**: logic errors, null/undefined access, wrong conditions, off-by-one
  - **Dead code**: unreachable branches, unused variables introduced by this change
  - **Security**: injection risks, exposed secrets, unsafe operations
  - **Bottlenecks**: obvious N+1 patterns, sync operations that block, missing indexes
- Writes structured output to `/tmp/review-output.md`

**Output format**:
```markdown
# Review Output

## Issues

### HIGH: path/to/file.ts:42
**Problem**: Description of the bug or issue
**Fix**: Exact change to apply

### MEDIUM: path/to/other.ts:17
**Problem**: ...
**Fix**: ...
```

If no issues: writes `# Review Output\n\nNo issues found.` and exits.

**What it does NOT flag**:
- Style nitpicks not in CLAUDE.md
- Test coverage gaps
- Issues in lines not changed in this diff
- Pre-existing issues
- Hypothetical edge cases

## Skill: `review-fix`

**What it does**:
1. Reads `/tmp/review-output.md`
2. If "No issues found" → exits immediately
3. For each issue:
   - Locates file and line
   - Verifies problem still exists (simplify may have already fixed it)
   - Applies minimal surgical fix as described
   - Skips test files

**Constraints**:
- Apply only the described fix — no refactoring beyond it
- If fix is ambiguous, skip and leave a comment in the file (not in tests)
- Never modify `.github/workflows/` files

## CI Pipeline

```yaml
# ci-implementation.yml — updated structure

services:
  postgres:                          # added for inline e2e
    image: postgres:16
    env: { POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD }
    ports: ["5432:5432"]

steps:
  - checkout
  - extract name
  - check if change exists
  - install openspec + node deps      # added: npm ci for e2e
  - apply (claude-code-base-action)
  - e2e tests (npm run test:e2e)
  - simplify (claude-code-base-action, prompt: simplify SKILL.md)
  - e2e tests
  - review (claude-code-base-action, prompt: review SKILL.md)
  - review-fix (claude-code-base-action, prompt: review-fix SKILL.md)
  - e2e tests
  - archive (claude-code-base-action)
  - git commit + push
  - promote to feature/
  - trigger ci-unit
```

## Prompt File Construction

Each Claude step uses a `prompt_file`. Pattern (same as existing apply/archive steps):

```bash
CONTENT=$(awk 'BEGIN{i=0} /^---$/{i++; next} i>=2{print}' ".claude/skills/<name>/SKILL.md")
cat > /tmp/<name>-prompt.txt << PROMPT
$CONTENT

Additional constraints:
- Non-interactive CI environment. Do NOT use AskUserQuestion tool.
- Do NOT modify any files under .github/workflows/
- Do NOT modify test files (*.spec.ts, *.test.ts, *.e2e.ts, **/test/**)
- Stay on current branch. Do NOT run git commands.
PROMPT
```

## E2E Test Step

```bash
cd applications/backend/api
npm ci --legacy-peer-deps
npm run test:e2e
```

Env vars required (from secrets):
- `DB_HOST: localhost`
- `DB_PORT: 5432`
- `DB_USER: fabrick`
- `DB_PASS: ${{ secrets.DB_PASS }}`
- `DB_TEST_NAME: fabrick_test`
- `DB_SSL: 'false'`
- `JWT_SECRET: ${{ secrets.JWT_SECRET }}`
