---
name: bootstrap-routing
description: Derive per-repo wiki-page routing rules from a tree-sitter snapshot and project root files. Detects language + framework, loads the matching framework hint, and emits a routing-rules.json + file-slug-map.json.
---

# Bootstrap routing rules for a code repository

You receive:
- `summary.json` — counts, top-N tables, decorator usage matrix (per-decorator: file-pattern distribution + co-occurring imports), kind counts, topLevelDirs, rootFileNames.
- `root-files.json` — verbatim contents of project-manifest / README / Dockerfile / build configs at the repo root (truncated to 8KB each).
- 20 sample symbols — full shape (signature with decorators, imports, file).
- A framework hint file (see `frameworks/*.md`) selected by language+framework detection.

Your job: emit a single JSON object that drives a downstream patcher. It maps source-code signals to one of four fixed wiki page slugs (`service.md`, `contracts.md`, `config.md`, `integrations.md`).

## Slugs (fixed)

- `service.md`      — WHAT the service is: identity, framework, deployment kind, lifecycle, replication
- `contracts.md`    — interfaces this service EXPOSES or CONSUMES at the message/transport boundary
- `config.md`       — runtime configuration the service reads: env vars, config sections, secrets
- `integrations.md` — EXTERNAL systems the service talks to (databases, brokers, cloud APIs, HTTP servers)

## Steps

### 1. Detect language + framework

Use `detect.md` rubric. Output one of:
- TypeScript + NestJS / Express / Fastify / Plain
- Python + FastAPI / Flask / Django / Plain
- Java + Spring Boot / Plain
- Go + Chi / Gin / Plain
- YAML + Kustomize / Helm / Plain
- Unknown

### 2. Load framework hint

If a `frameworks/<framework>.md` exists, treat its content as authoritative starter rules for that framework. Otherwise use `frameworks/_default.md`.

The hint lists, per slug:
- typical decorators / annotations
- typical import paths
- typical file-name patterns
- typical EXTERNAL integration packages
- gotchas (generic helpers to exclude, project-specific traps)

### 3. Tune against actual snapshot

Cross-reference the hint with the snapshot:
- Drop decorators not present in `decoratorMatrix`.
- Drop file patterns that match zero files.
- Add decorators/patterns observed in the matrix that the hint missed.
- For each decorator, apply the threshold: count >= 5 AND >= 80% concentration in one slug-mapped file pattern, OR always co-imports a slug-specific external library.
- For each import path, decide internal vs external (project-prefixed / relative / scoped to the repo = internal).

### 4. Emit output

JSON object:

```json
{
  "repoName": "<from input>",
  "project": {
    "language":      "<TypeScript | Python | Java | Go | YAML | ...>",
    "framework":     "<framework name or null>",
    "kind":          "<service | monorepo | library | gitops | infrastructure | unknown>",
    "runCommands":   ["<entry from manifest>", ...],
    "buildCommands": ["<entry from manifest>", ...],
    "apps":          [{ "name": "<>", "root": "<>", "entry": "<>" }],
    "summary":       "<1-3 sentence project description>"
  },
  "frameworks": ["..."],
  "internalLibs": ["..."],
  "decorators": {
    "service":      ["..."],
    "contracts":    ["..."],
    "config":       ["..."],
    "integrations": ["..."]
  },
  "imports": {
    "service":      ["..."],
    "contracts":    ["..."],
    "config":       ["..."],
    "integrations": { "<import path>": "<short label>" }
  },
  "filePatterns": {
    "<glob>": ["<slug>", "<slug>"]
  },
  "notes": "1-3 short observations about this project that future routing should respect"
}
```

Glob conventions:
- `*.X.ts` matches any file with that double-suffix anywhere in the tree
- `**/path/to/*.ts` for path-prefixed matches
- Patterns without `/` are treated as basename matches

## Output discipline

- ONLY the JSON object. No markdown fences, no preamble.
- Only emit decorators/imports/paths that ACTUALLY appear in the snapshot.
- Empty arrays are fine if a category has no signal.
- The `notes` field is the one place to record project-specific traps.
