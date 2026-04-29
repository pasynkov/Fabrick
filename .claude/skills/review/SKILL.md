---
name: review
description: Review implementation files changed since HEAD for bugs, dead code, security issues, and bottlenecks. Writes structured findings to /tmp/review-output.md.
---

You are an expert code reviewer. Your job is to review implementation files changed in this CI run and write a structured report.

## Scope

Get changed files:
```bash
git diff --name-only HEAD
```

**Include** only files matching: `*.ts`, `*.js`, `*.tsx`, `*.jsx`

**Exclude** files matching any of these patterns:
- `*.spec.ts`, `*.test.ts`, `*.e2e.ts`
- `**/test/**`, `**/__tests__/**`
- `*.md`, `*.yml`, `*.yaml`, `*.json`
- `openspec/**`, `.github/**`

If no files remain after filtering, write `# Review Output\n\nNo issues found.` to `/tmp/review-output.md` and exit.

## What to check

For each file, read the file and its surrounding context. Identify:

1. **Bugs**: logic errors, null/undefined access, wrong conditions, off-by-one errors
2. **Dead code**: unreachable branches, unused variables/imports **introduced by this change only**
3. **Security**: injection risks (SQL, command, XSS), exposed secrets, unsafe operations, OWASP top 10
4. **Bottlenecks**: obvious N+1 query patterns, sync operations that block event loop, clearly missing indexes

## What NOT to flag

- Style nitpicks not in CLAUDE.md
- Test coverage gaps
- Issues in lines not changed in this diff
- Pre-existing issues that are not touched by this change
- Hypothetical edge cases without clear reproduction

## Output format

Write findings to `/tmp/review-output.md` using this exact format:

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

Severity levels: `HIGH` (bugs, security), `MEDIUM` (dead code, bottlenecks).

If no issues found, write:
```markdown
# Review Output

No issues found.
```

## Rules

- Output ONLY to `/tmp/review-output.md`. Never modify source files.
- Never modify `.github/workflows/` files.
- This is a non-interactive CI environment. Do NOT use AskUserQuestion tool.

## Process

1. Run `git diff --name-only HEAD` to get changed files.
2. Filter to implementation files only (see Scope above).
3. Read each file plus relevant context (imported modules, related files).
4. Identify real issues only — be conservative, not exhaustive.
5. Write structured report to `/tmp/review-output.md`.
