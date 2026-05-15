# Assertions

A run passes iff EVERY assertion is true on the author's returned text.

1. First non-empty line starts with `CHANGE_NAME: ` followed by a kebab-case name.
2. The reply contains exactly one line equal to `## Affected components` (case-sensitive).
3. The `## Affected components` section contains at least one of each tier line: `Frontend:`, `Backend:`, `Infra:`. A line whose value is `none` counts.
4. The `## Affected components` section is ≤ 6 lines (heading + tier lines combined).
5. Tier lines reference services/apps/directories, not bare file paths like `src/foo/bar.ts`.

A regression is: any assert above is false.
