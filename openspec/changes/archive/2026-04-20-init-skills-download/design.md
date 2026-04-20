## Context

Backend uses NestJS + MinIO. Skills are static files committed to this repo under `.claude/skills/`. The three skills going to users (`fabrick-analyze`, `fabrick-push`, `fabrick-search`) are stable enough to bundle as a build-time asset. MinIO is not needed for global defaults — serving directly from the NestJS process is simpler and has no runtime dependencies.

CLI uses Node.js 18+ with no zip library currently installed.

## Goals / Non-Goals

**Goals:**
- Bundle 3 skills as zip asset in the backend
- Serve zip via authenticated endpoint
- CLI downloads and extracts on init (overwriting `fabrick-*` only)
- AI tool selection prompt (single choice: Claude)

**Non-Goals:**
- Per-org or per-project skill customization (future)
- Multiple AI tool support beyond Claude (future)
- Skill versioning or update command (future)
- `fabrick-synthesis` distributed to users (runs server-side)

## Decisions

### 1. Zip bundled in NestJS assets, not MinIO

Skills are global defaults — same for every org/project. Storing in MinIO adds a runtime dependency and complicates seeding. NestJS `assets` config copies files to `dist/` at build time. Controller reads from `__dirname/../assets/claude-skills.zip` and streams to client.

**Alternative considered**: Seed MinIO on org creation — rejected for MVP (adds complexity, requires bucket-per-org logic for defaults that are identical everywhere).

### 2. Zip structure: flat, only `fabrick-analyze`, `fabrick-push`, `fabrick-search`

```
claude-skills.zip
├── fabrick-analyze/
│   ├── SKILL.md
│   ├── patterns.md
│   ├── scanner.md
│   └── synthesis.md
├── fabrick-push/
│   └── SKILL.md
└── fabrick-search/
    └── SKILL.md
```

Extracted directly into `.claude/skills/`. No manifest needed for MVP.

### 3. Extraction rule: overwrite `fabrick-*`, skip others

CLI iterates zip entries. If top-level directory starts with `fabrick-`, write unconditionally. Otherwise skip. This preserves user skills (`npm-publish-cli`, etc.) and internal skills (`openspec-*`).

### 4. `adm-zip` for CLI zip extraction

Node.js 18 has no built-in zip. Backend already has `unzipper` but it's not in CLI deps. `adm-zip` is synchronous, zero-dep, works in Node 18+ — simplest choice for CLI use.

**Alternative**: `unzipper` (streaming, already in backend) — rejected for CLI because async streaming adds complexity for a one-shot extraction.

### 5. AI tool prompt: single select, defaults to Claude

For MVP with one option, still ask — establishes the pattern for future tools and writes `ai_tool` to config so future CLI commands can branch on it.

## Risks / Trade-offs

- **Risk**: zip asset gets out of sync with actual skills source. → Mitigation: zip is generated from source as part of build/deploy (manual step for now, CI later).
- **Risk**: `adm-zip` adds ~500KB to CLI install. → Acceptable for MVP.

## Migration Plan

1. Create `claude-skills.zip` from current `.claude/skills/fabrick-{analyze,push,search}/`
2. Place in `applications/backend/api/src/assets/`
3. Update `nest-cli.json` assets
4. Add skills endpoint + module
5. Update CLI `init.command.ts`
6. Rebuild and redeploy
