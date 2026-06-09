## REMOVED Requirements

### Requirement: `fabrick scan` computes file content hashes and outputs diff
**Reason**: The v2 sync pipeline replaces standalone scan with an internal helper used by `fabrick sync`. Public hash-diff output is no longer needed because mode decisions and threshold calculations are made inside the CLI from `simple-git` diffs and tree-sitter snapshots.
**Migration**: Replace any caller of `fabrick scan` with `fabrick sync --dry-run`, which prints the per-scope plan (mode, token counts, threshold). The internal scanning helper is still available to the pipeline but is not exposed as a command.

### Requirement: `fabrick rebuild-source-map` rebuilds metadata after wiki generation
**Reason**: Source map regeneration is folded into the dossier write path — frontmatter and link bookkeeping are stamped deterministically when pages are produced by `fabrick sync` / `fabrick regen`. A standalone command is no longer needed.
**Migration**: Re-run `fabrick sync` (or `fabrick regen` after a clean wipe) to refresh page metadata; the deterministic index pages are emitted automatically.

### Requirement: Affected pages resolved by LLM using source-map.json
**Reason**: The v2 pipeline computes affected scopes/slugs from `git diff` and the per-scope router (`file-slug-map.json`) emitted by `fabrick bootstrap`, not from an LLM-resolved source map.
**Migration**: Run `fabrick bootstrap` to refresh `file-slug-map.json` after major restructures; downstream pipeline steps consume that map directly without involving the LLM.
