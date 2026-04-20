## Context

Currently Fabrick skills (`fabrick-analyze`, `fabrick-push`) live in the project repo and must be manually copied into `.claude/skills/`. The `fabrick-push` skill runs curl directly. There is no consistent way to bootstrap a new project. A global CLI removes the manual steps and owns the push logic in code rather than a skill prompt.

## Goals / Non-Goals

**Goals:**
- Single global binary `fabrick` installable via `npm install -g fabrick`
- `fabrick init` bootstraps any repo in seconds
- `fabrick push` owns the zip+upload logic, replaces curl in the skill
- Skills embedded in the CLI package — no network required on init
- `.fabrick/config.yaml` as the coordination contract between CLI and skills

**Non-Goals:**
- Authentication / API tokens (v2)
- `fabrick analyze` as a CLI command (Claude runs analysis, not the CLI)
- Remote skill updates / `fabrick update-skills`
- Multi-AI tool support beyond Claude Code
- Production backend URL (hardcoded localhost for now)

## Decisions

### D1: Skills embedded in CLI package, not downloaded

Embed `fabrick-analyze/SKILL.md` as a static asset inside the npm package. On `fabrick init`, copy to `.claude/skills/fabrick-analyze/SKILL.md` in the current project.

**Alternatives considered:**
- Download from GitHub raw URL — requires network, fragile on URL changes
- Download from backend `/skills/` endpoint — couples CLI init to backend availability

**Rationale:** Offline-first, zero dependencies at init time. Updates come via `npm update -g fabrick`.

### D2: Skills installed locally per project, not globally

Copy skills into `.claude/skills/` in the current working directory, not `~/.claude/skills/`.

**Alternatives considered:**
- Global `~/.claude/skills/` — works anywhere but invisible, harder to version per project

**Rationale:** Local install is explicit and auditable. Future: dynamic skill selection per project type.

### D3: `fabrick-push` skill delegates to CLI

Updated `fabrick-push` SKILL.md becomes a thin wrapper:
```
Run: fabrick push
If not installed: npm install -g fabrick
```

**Rationale:** Push logic lives in one place (CLI). Skill stays as the Claude Code entry point.

### D4: Package structure as monorepo sibling

New package at `applications/cli/` alongside `applications/backend/`. Plain Node.js with no framework — only `commander` for CLI parsing, `archiver` for zip, `node-fetch` (or native fetch) for upload, `yaml` for config, `inquirer` for interactive prompts.

### D5: Backend URL hardcoded, overridable via config

Default: `http://localhost:3000`. If `.fabrick/config.yaml` has `backendUrl` field, that overrides. No CLI flag for now.

## Risks / Trade-offs

- **Embedded skills go stale** → Mitigation: `fabrick init` warns if `.claude/skills/fabrick-analyze/SKILL.md` already exists and differs (offer to overwrite). `npm update -g fabrick` refreshes.
- **No auth means open push** → Acceptable for localhost-only MVP. Any public deployment needs tokens before going live.
- **CLI owns push, skill is thin** → If skill is run without CLI installed, error message must be clear.

## Migration Plan

1. Implement and publish `fabrick` to npm
2. Update `fabrick-push` SKILL.md in this repo to delegate to CLI
3. Old skill-based push still works until skill is updated — no breaking change
