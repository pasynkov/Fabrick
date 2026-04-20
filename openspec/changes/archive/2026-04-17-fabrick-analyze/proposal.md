## Why

Developers need a way to extract structured context from their repositories without manually cataloguing endpoints, env vars, or business logic. This Claude Code skill automates that extraction, producing a `.fabrick/context/` folder that can be pushed to the Fabrick backend.

## What Changes

- Add Claude Code skill `.claude/skills/fabrick-analyze/SKILL.md`
- Skill performs two-phase analysis: rule-based extraction + Claude summary
- Writes `.fabrick/config.yaml` (project/repo name from folder name)
- Writes `.fabrick/context/` with structured YAML + Markdown files

## Capabilities

### New Capabilities

- `fabrick-analyze`: Extract structured context from a repository into `.fabrick/context/`

### Modified Capabilities

<!-- none -->

## Impact

- New file: `.claude/skills/fabrick-analyze/SKILL.md`
- Creates `.fabrick/` in the target repository (should be gitignored or committed — developer's choice)
- Calls Claude API locally — no source code leaves the machine
