## Why

The `ci-implementation.yml` pipeline currently runs Claude to implement tasks, then immediately archives and commits. There is no automated code quality gate: no simplification pass (DRY, dead code removal), no bug/security review, and no e2e validation between phases.

This means Claude-generated code ships as-is — potentially with redundancy, security issues, or subtle bugs that would be caught by a review step. Adding a simplify → review → fix loop between implementation and archive, with e2e tests as gates, ensures quality before merging.

## What Changes

- Add three new skills to `.claude/skills/`:
  - `simplify`: DRY and compact changed implementation files
  - `review`: analyze changed files for bugs, dead code, security issues — output structured report
  - `review-fix`: apply fixes from review report to implementation files
- Update `ci-implementation.yml` to run the extended pipeline:
  1. Implement (existing)
  2. E2E tests
  3. Simplify
  4. E2E tests
  5. Review → generate report
  6. Review-fix → apply from report
  7. E2E tests
  8. Archive + commit (existing)
- All three skills operate only on files changed since HEAD (git diff scope), excluding test files

## Capabilities

### New Capabilities
- `ci-simplify-skill`: Skill that reads `git diff --name-only HEAD`, applies DRY and compactness improvements to non-test implementation files
- `ci-review-skill`: Skill that reviews changed files for bugs, dead code, security issues and writes structured findings to `/tmp/review-output.md`
- `ci-review-fix-skill`: Skill that reads `/tmp/review-output.md` and applies fixes to non-test files

### Modified Capabilities
- `ci-implementation-pipeline`: Extended pipeline with quality gates and e2e checkpoints

## Impact

- Implementation CI runs longer (3 additional Claude steps + 2 additional e2e runs)
- CI job gains Postgres service container for inline e2e testing
- Committed code will be more compact and reviewed before merging
- Test files are never modified by simplify or review-fix steps
- No changes to developer workflow — pipeline runs automatically on `implementation/**` push
