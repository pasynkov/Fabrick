## Why

The DoD for the Fabrick PoC is: ask a natural language question about the system architecture and get a correct, targeted answer. This Claude Code skill implements that — navigating the `architecture/` folder intelligently rather than loading everything into context at once.

## What Changes

- Add Claude Code skill `.claude/skills/fabrick-search/SKILL.md`
- Skill reads `architecture/index.md` first, then navigates to relevant files only
- Answers questions like "which app handles X?", "what are the envs for Y?"

## Capabilities

### New Capabilities

- `fabrick-search`: Answer architectural questions by navigating the synthesized architecture document

### Modified Capabilities

<!-- none -->

## Impact

- New file: `.claude/skills/fabrick-search/SKILL.md`
- Read-only — does not modify any files
- This is the final verification step for the entire PoC
