---
name: commit
description: Commit changes in the Fabrick repo. Updates README.md to reflect current project state before committing. Use when user says "commit", "закоммить", "сделай коммит", "/commit".
license: MIT
metadata:
  author: pasynkov
  version: "1.0"
---

Commit changes with an up-to-date README.

## Steps

1. **Show diff summary**

   Run `git status` and `git diff --stat HEAD`. Show what's changing.

2. **Update README.md**

   Read `README.md` and read the changed files from the diff to understand what's new.

   Rewrite or update the `## 🚀 Getting Started` section (create it if absent) to reflect the current real state:
   - CLI install: `npm install -g @fabrick/cli`
   - Auth: `fabrick login`
   - Init: `fabrick init` (org, project, AI tool selection, installs skills)
   - Analyze: run `/fabrick-analyze` in Claude Code
   - Push: run `/fabrick-push` in Claude Code
   - Search: run `/fabrick-search` in Claude Code

   Keep all other sections intact. Only update what's factually changed.
   Write the updated README.md.

3. **Stage everything**

   ```bash
   git add -A
   ```

4. **Generate commit message**

   Conventional Commits format:
   - `<type>(<scope>): <summary>` — ≤50 chars, imperative
   - Types: `feat`, `fix`, `refactor`, `test`, `chore`, `build`, `docs`
   - Scope = area changed (e.g. `cli`, `api`, `skills`, `auth`)
   - Body only if "why" isn't obvious from subject
   - No trailing period, no AI attribution

   Show proposed message. If user approves, commit. If they want changes, adjust and commit.

5. **Commit**

   ```bash
   git commit -m "<message>"
   ```

## Guardrails
- Never push — commit only
- Don't rewrite README marketing sections (Why, What, Privacy) — only Getting Started
- If git has nothing to commit, say so and stop
