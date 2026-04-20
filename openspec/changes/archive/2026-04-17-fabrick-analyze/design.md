## Context

This is a Claude Code skill — it runs inside a developer's repo. Claude has full read access to the filesystem, can run Bash commands, and can call itself for summarization. No external API calls needed beyond what Claude Code already does.

## Goals / Non-Goals

**Goals:**
- Detect project type and framework
- Extract endpoints, env var names, dependencies via rule-based parsing
- Generate overview.md and logic.md via Claude reading actual code
- Write everything to `.fabrick/context/`

**Non-Goals:**
- Sending data anywhere (that's fabrick-push)
- Reading README (intentionally ignored — usually stale)
- Extracting env values (only names)
- Handling monorepos (single app per run)

## Decisions

### Two-phase approach
**Phase 1 — rule-based** (fast, deterministic):
- `meta.yaml`: framework detection from `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`
- `endpoints.yaml`: glob for route/controller files → parse paths and HTTP methods
- `envs.yaml`: grep for `process.env.`, `os.getenv(`, `ENV[`, etc. → collect unique names
- `dependencies.yaml`: parse package manager manifest directly

**Phase 2 — Claude reads code** (smart, narrative):
- Collect top ~20 files: entry points + routes/controllers + services
- Limit: skip files > 200 lines or binary files
- Claude writes `overview.md` (what the app does) and `logic.md` (key flows from code)

### README intentionally ignored
READMEs are typically outdated. Code is the source of truth.

### File selection for Claude
Priority order:
1. Entry points: `index.ts`, `main.ts`, `app.ts`, `server.ts`, `index.js`
2. Route/controller files (already found in Phase 1)
3. Service files: `src/services/`, `src/*/service.ts`
4. Stop at ~20 files or ~30k tokens

### Output structure
```
.fabrick/
├── config.yaml            project name (= folder name), repo name (= folder name)
└── context/
    ├── meta.yaml
    ├── endpoints.yaml
    ├── envs.yaml
    ├── dependencies.yaml
    ├── overview.md
    └── logic.md
```

## Risks / Trade-offs

- Rule-based endpoint extraction is framework-specific → start with Express/NestJS/Next.js, cover common patterns
- Logic extraction quality depends on code clarity → Claude does its best, imperfect is fine for PoC
