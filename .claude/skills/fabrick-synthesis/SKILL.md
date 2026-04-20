---
name: fabrick-synthesis
description: Synthesize multiple repo context folders into a unified, navigable architecture document. Reads from downloaded/ directory and writes to architecture/. Run after downloading context from Fabrick backend.
---

Synthesize all repo context folders from `downloaded/` into a structured `architecture/` directory. This makes the system understandable at both the overview level and the per-app level without loading everything into context at once.

---

## Step 1: Discover Repos

List all subdirectories of `downloaded/`:

```bash
ls downloaded/
```

For each subdirectory, confirm it has a `context/` folder:

```bash
ls downloaded/<repo>/context/
```

If `downloaded/` does not exist, stop and report:
> Error: `downloaded/` directory not found. Create it and place repo context folders inside (each as `downloaded/<repo-name>/context/`).

If a subdirectory is missing `context/`, skip it with a warning:
> Warning: Skipping `<repo>` — no `context/` folder found.

List all discovered repos and their context files before proceeding. Show the user what will be synthesized.

---

## Step 2: Read All Context

For each discovered repo, read all files in `downloaded/<repo>/context/`:
- `meta.yaml` — language, framework, version
- `endpoints.yaml` — HTTP routes
- `envs.yaml` — environment variable names
- `dependencies.yaml` — production dependencies
- `overview.md` — what the app does
- `logic.md` — key business flows

Skip any file that doesn't exist (not all repos will have all files).

---

## Step 3: Create Output Directories

```bash
mkdir -p architecture/apps
mkdir -p architecture/cross-cutting
```

---

## Step 4: Write Per-App Files

For each repo, write `architecture/apps/<repo>.md`.

Each file must be **self-contained** — a reader should be able to understand the app fully without reading any other file. Include:

```markdown
# <repo>

## Purpose
<What this app does — derived from overview.md>

## Framework & Language
<From meta.yaml>

## Key Business Flows
<From logic.md — key flows described concisely>

## API Endpoints
<From endpoints.yaml — method, path, brief description of each>

## Environment Variables
<From envs.yaml — name + inferred description based on context>

## Dependencies
<From dependencies.yaml — key production dependencies>
```

Write one file per repo.

---

## Step 5: Write Cross-Cutting Files

### `architecture/cross-cutting/integrations.md`

Based on all context read, describe:
- Which apps call which other apps (inferred from endpoints + dependencies)
- What protocols/contracts they use (HTTP, shared storage, queues, etc.)
- Any shared infrastructure (databases, object storage, queues)

If no inter-app calls are evident, document what is known and note that calls may exist at runtime.

### `architecture/cross-cutting/envs.md`

Aggregate all env vars from all repos. For each:
- Name
- Which repo(s) use it
- Inferred description (based on name and context)

Group by concern (e.g., Storage, Auth, Messaging, etc.).

---

## Step 6: Write `architecture/overview.md`

High-level description of the whole system:
- What the system does end-to-end
- How many apps, what each one's role is
- Key data flows (what data enters, transforms, exits)
- Infrastructure dependencies (what external services are needed)

Write this as a 1-2 page summary that orients a new developer.

---

## Step 7: Write `architecture/index.md` (LAST)

Write this after all other files exist. It is the **navigation guide** — tells readers which file to consult for which type of question.

```markdown
# Architecture Index

## Navigation Guide

| Question type | Read this file |
|---|---|
| What does the whole system do? | overview.md |
| Questions about <repo-name> | apps/<repo-name>.md |
| Which app calls which? | cross-cutting/integrations.md |
| All env vars across apps | cross-cutting/envs.md |

## File Map

- `overview.md` — system-wide purpose and data flow
- `apps/` — one file per repo, self-contained
  - `apps/<repo>.md` — <one-line summary>
- `cross-cutting/`
  - `integrations.md` — inter-app calls and shared infrastructure
  - `envs.md` — all environment variables, grouped by concern

## Repos Synthesized

List each repo with its framework and brief purpose.
```

---

## Output Checklist

After completing synthesis, list all files written:

- [ ] `architecture/index.md`
- [ ] `architecture/overview.md`
- [ ] `architecture/apps/<repo>.md` for each repo
- [ ] `architecture/cross-cutting/integrations.md`
- [ ] `architecture/cross-cutting/envs.md`

Report total files written and note any repos that were skipped (with reason).
