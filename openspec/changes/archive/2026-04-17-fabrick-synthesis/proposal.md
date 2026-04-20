## Why

After context from multiple repos lands in MinIO, it needs to be synthesized into a single coherent architecture document. This Claude Code skill takes locally downloaded context folders and produces a navigable `architecture/` structure that Claude can query without loading everything into context at once.

## What Changes

- Add Claude Code skill `.claude/skills/fabrick-synthesis/SKILL.md`
- Skill reads all repo context folders from a local `downloaded/` directory
- Uses Claude to synthesize a unified architecture
- Writes `architecture/` with index, per-app files, and cross-cutting concerns

## Capabilities

### New Capabilities

- `fabrick-synthesis`: Synthesize multiple repo contexts into a unified, navigable architecture document

### Modified Capabilities

<!-- none -->

## Impact

- New file: `.claude/skills/fabrick-synthesis/SKILL.md`
- Creates `architecture/` in the working directory
- No changes to existing files
