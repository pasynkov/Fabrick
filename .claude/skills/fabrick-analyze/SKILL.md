---
name: fabrick-analyze
description: Extract structured context from a repository into .fabrick/context/ — framework detection, connection points (inbound + outbound, all protocols), env vars, domain entities and business rules, AI-generated summaries. Supports polyglot and DevOps repos. Handles monorepos. Use when the user wants to analyze their repo before pushing context to Fabrick.
---

Analyze the current repository and produce structured context in `.fabrick/context/`. Run in the root of the target repository.

**Do not read README files — intentionally excluded as stale source.**

---

## Phase 0: Setup

1. Get repo name:
   ```bash
   basename $(pwd)
   ```

2. Read patterns library (may be empty):
   ```
   .claude/skills/fabrick-analyze/patterns.md
   ```

3. Detect monorepo:
   - Check for `nx.json`, `turbo.json`, `lerna.json` → confirmed
   - Check for `go.work` → Go monorepo
   - Check `apps/` or `packages/` for 2+ subdirs each with manifest
   - Check `pom.xml` for `<modules>` → Java multi-module

   If monorepo: enumerate apps (subdirs with own manifests under `apps/`/`packages/` or `<modules>` entries).

4. Create output dirs:
   - Single app: `mkdir -p .fabrick/context .fabrick/tmp`
   - Monorepo: `mkdir -p .fabrick/context/apps/<app-name> .fabrick/tmp` for each app

5. Write `.fabrick/config.yaml`:
   ```yaml
   project: <folder-name>
   repo: <folder-name>
   backendUrl: http://localhost:3000
   ```

---

## Phase 1: Scanner (Haiku)

For each app (or the single app), invoke the scanner agent:

1. Write task file `.fabrick/tmp/scanner-task.md`:
   ```
   You are the fabrick-analyze scanner agent. Read and follow scanner.md exactly.

   Repo root: <absolute path>
   App directory: <app subdir, or "." for single app>
   Output file: .fabrick/tmp/raw-extraction.yaml

   ---
   [paste full contents of .claude/skills/fabrick-analyze/scanner.md here]

   ---
   ## Known Patterns
   [paste full contents of .claude/skills/fabrick-analyze/patterns.md here, or "(none)" if empty]
   ```

2. Invoke Haiku scanner:
   ```bash
   claude -p "$(cat .fabrick/tmp/scanner-task.md)" --model claude-haiku-4-5-20251001 --dangerously-skip-permissions
   ```

3. Verify `.fabrick/tmp/raw-extraction.yaml` was written. If missing or empty, log error and continue with empty extraction.

For monorepos: run scanner once per app, merge outputs before synthesis.

---

## Phase 2: Synthesis (current session)

Read `.fabrick/tmp/raw-extraction.yaml`. Follow `synthesis.md` exactly to produce all final output files.

---

## Phase 3: Cross-App Pass (monorepos only)

After synthesis completes for all apps:
- Compare `connection_points.outbound` entries across apps for matching `inbound` entries
- Match by: topic/subject (messaging) or path+method (HTTP)
- Write `.fabrick/context/cross-app.yaml`

---

## Phase 4: Cleanup

```bash
rm -rf .fabrick/tmp
```

---

## Output Checklist

**Single app:**
- [ ] `.fabrick/config.yaml`
- [ ] `.fabrick/context/meta.yaml`
- [ ] `.fabrick/context/connection_points.yaml`
- [ ] `.fabrick/context/envs.yaml`
- [ ] `.fabrick/context/overview.md`
- [ ] `.fabrick/context/logic.md`
- [ ] `.fabrick/context/domain.md` (skip for infrastructure repos)

**Monorepo:**
- [ ] `.fabrick/context/meta.yaml` (repo-level)
- [ ] `.fabrick/context/cross-app.yaml`
- [ ] `.fabrick/context/apps/<app-name>/` — all above files per app

Report written files and any that could not be generated (with reason).
