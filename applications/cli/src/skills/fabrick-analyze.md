---
name: fabrick-analyze
description: Extract structured context from a repository into .fabrick/context/ — framework detection, endpoints, env vars, dependencies, and AI-generated summaries. Use when the user wants to analyze their repo before pushing context to Fabrick.
---

Analyze the current repository and produce structured context in `.fabrick/context/`. Run in the root of the target repository.

**Do not read README files — they are intentionally excluded as a stale source.**

---

## Phase 0: Setup

1. Determine the current repo name from the folder name:
   ```bash
   basename $(pwd)
   ```

2. Create directories:
   ```bash
   mkdir -p .fabrick/context
   ```

3. Write `.fabrick/config.yaml`:
   ```yaml
   project: <folder-name>
   repo: <folder-name>
   backendUrl: http://localhost:3000
   ```

---

## Phase 1: Rule-Based Extraction

### 1a. Framework Detection → `meta.yaml`

Check which manifest files exist:
- `package.json` → Node.js; read `name`, `version`, detect framework from deps (`@nestjs/*` → NestJS, `express` → Express, `next` → Next.js, `fastify` → Fastify)
- `requirements.txt` or `pyproject.toml` → Python; detect (`django`, `flask`, `fastapi`)
- `go.mod` → Go; detect (`gin`, `echo`, `fiber`)
- `Cargo.toml` → Rust; detect (`actix`, `axum`, `warp`)

Write `.fabrick/context/meta.yaml`:
```yaml
language: <detected>
framework: <detected or "unknown">
version: <from manifest or "unknown">
packageManager: <npm|pip|go|cargo|unknown>
```

### 1b. Endpoints → `endpoints.yaml`

Search for route/controller files and extract HTTP method + path patterns.

**NestJS/Express patterns:**
```bash
grep -rn "@Get\|@Post\|@Put\|@Delete\|@Patch\|router\.\(get\|post\|put\|delete\|patch\)" \
  --include="*.ts" --include="*.js" -l
```

For each matching file, extract lines containing route decorators or method calls. Parse out the HTTP method and path string.

**Next.js**: check `app/` or `pages/api/` directory structure for route segments.

**Python (Flask/FastAPI)**:
```bash
grep -rn "@app\.\(get\|post\|put\|delete\|patch\)\|@router\." --include="*.py" -l
```

Write `.fabrick/context/endpoints.yaml`:
```yaml
endpoints:
  - method: GET
    path: /context/:repo
    file: src/context/context.controller.ts
  - method: POST
    path: /context/:repo
    file: src/context/context.controller.ts
```

If no endpoints found, write `endpoints: []`.

### 1c. Environment Variables → `envs.yaml`

Grep for env var access patterns across the codebase. **Collect names only — never values.**

```bash
grep -rh \
  -e 'process\.env\.\([A-Z_][A-Z0-9_]*\)' \
  -e 'os\.getenv(\s*["\x27]\([A-Z_][A-Z0-9_]*\)' \
  -e 'ENV\[\s*["\x27]\([A-Z_][A-Z0-9_]*\)' \
  -e 'os\.environ\[\s*["\x27]\([A-Z_][A-Z0-9_]*\)' \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.rb" \
  . 2>/dev/null | grep -oP '(?<=process\.env\.)[A-Z_][A-Z0-9_]*|(?<=getenv\(["\x27])[A-Z_][A-Z0-9_]*|(?<=ENV\[["\x27])[A-Z_][A-Z0-9_]*' | sort -u
```

Alternatively use multiple targeted greps and combine results. Write `.fabrick/context/envs.yaml`:
```yaml
envVars:
  - MINIO_ENDPOINT
  - MINIO_PORT
  - MINIO_ACCESS_KEY
  - MINIO_SECRET_KEY
```

If none found, write `envVars: []`.

### 1d. Dependencies → `dependencies.yaml`

Parse the primary package manifest:

- **Node.js**: Read `package.json`, extract `dependencies` keys (production only, not devDependencies)
- **Python**: Read `requirements.txt` line by line, strip version pins — or parse `[project.dependencies]` from `pyproject.toml`
- **Go**: Read `go.mod`, extract `require` block entries
- **Rust**: Read `Cargo.toml`, extract `[dependencies]` keys

Write `.fabrick/context/dependencies.yaml`:
```yaml
dependencies:
  - "@nestjs/common"
  - "@nestjs/core"
  - minio
  - unzipper
```

---

## Phase 2: Claude Analysis

### 2a. Collect Key Files

Find up to 20 key source files. Priority order:
1. Entry points: `index.ts`, `main.ts`, `app.ts`, `server.ts`, `index.js`, `main.py`, `app.py`, `main.go`
2. Route/controller files found in Phase 1b
3. Service files: match `**/*service*.ts`, `**/*service*.py`, `**/*.service.ts`
4. Skip any file that is binary or longer than 200 lines

Use Glob and Read tools to collect these files. Stop at ~20 files.

### 2b. Write `overview.md`

Read the collected files. Write `.fabrick/context/overview.md` with ~1 page describing:
- What the application does (purpose, domain)
- What kind of app it is (API server, CLI, web app, etc.)
- Key entities or resources it manages
- Primary external dependencies (databases, queues, object storage, etc.)

**Ground in actual code. Do not invent. Do not quote README.**

### 2c. Write `logic.md`

Write `.fabrick/context/logic.md` describing key business flows observed in the code:
- Main request/response flows (what happens end-to-end for the primary endpoints)
- Data transformation steps
- Integration points with external services
- Initialization logic (startup, migrations, seed data)

**Reference specific files and functions by name. Do not describe what the code looks like — describe what it does.**

---

## Output Checklist

After completing all phases, verify all files exist:

- [ ] `.fabrick/config.yaml`
- [ ] `.fabrick/context/meta.yaml`
- [ ] `.fabrick/context/endpoints.yaml`
- [ ] `.fabrick/context/envs.yaml`
- [ ] `.fabrick/context/dependencies.yaml`
- [ ] `.fabrick/context/overview.md`
- [ ] `.fabrick/context/logic.md`

Report which files were written and any that could not be generated (with reason).
