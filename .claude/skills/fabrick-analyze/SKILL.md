---
name: fabrick-analyze
description: Build or update the repo wiki (.fabrick/wiki/). Uses CLI for hash-based
  change detection, then LLM reads source code and generates wiki pages directly.
  Supports monorepos — produces per-app wikis.
---

Analyze the current repository and produce a wiki in `.fabrick/wiki/`. Run in the root of the target repository.

---

## Step 1: Scan for changes

```bash
npx @fabrick/cli scan
```

This outputs JSON to stdout:
```json
{
  "mode": "full" | "incremental",
  "changed": ["src/models/user.ts", ...],
  "added": ["src/new-thing.ts", ...],
  "deleted": ["src/old-thing.ts", ...],
  "totalFiles": 342
}
```

- If `mode=full` and `totalFiles=0`: nothing to analyze, stop.
- If `mode=incremental` and `changed=[] added=[] deleted=[]`: wiki is up to date, stop and report.

---

## Step 2: Detect project structure

Look at the file paths from scan output. Check for monorepo indicators:
- Multiple `apps/*/` or `packages/*/` directories each with their own `package.json`
- `nx.json`, `turbo.json`, `lerna.json`, or `go.work` at root
- `pom.xml` with `<modules>`

**Single app**: wiki goes in `.fabrick/wiki/`  
**Monorepo**: wiki goes in `apps/<app-name>/.fabrick/wiki/` per app

---

## Step 3: Read source files

**Full mode**: read all source files (or representative key files for very large repos)

**Incremental mode**:
1. Read `.fabrick/wiki/source-map.json` (or per-app path)
2. Find which wiki pages reference the changed/added files
3. Read only: changed/added source files + affected wiki pages + `index.md`

**Skip**: `node_modules/`, `.git/`, `.fabrick/`, `dist/`, `build/`, `coverage/`

---

## Step 4: Generate or update wiki pages

Write `.md` files to `.fabrick/wiki/` (or per-app path) following this exact format:

```markdown
---
slug: entities/user
category: entities
sources:
  - src/models/user.ts
  - src/dto/user.dto.ts
related:
  - entities/order
  - logic/auth-flow
updated: 2026-05-08
---

# User

[markdown content describing this concept]

## Related Pages
- [Order](../entities/order.md) — User has many Orders
- [Auth Flow](../logic/auth-flow.md) — login/register uses User
```

**Taxonomy** (starter categories — add custom ones if the codebase warrants):
- `entities/` — domain models, data structures, DB schemas
- `logic/` — business flows, algorithms, processes
- `contracts/` — API endpoints, request/response schemas
- `transport/` — messaging topics/events, queues, gRPC
- `config/` — environment variables grouped by concern
- Custom categories (e.g. `middleware/`, `auth/`, `integrations/`) if useful

**index.md** (required):
```markdown
# Wiki Index

## Entities
- [User](entities/user.md) — Core user model with email auth
- [Order](entities/order.md) — Purchase order with line items

## Logic
- [Auth Flow](logic/auth-flow.md) — Login, register, JWT lifecycle

## Contracts
- [REST API](contracts/rest-api.md) — All HTTP endpoints

...
```

**Incremental**: update only affected pages + index.md. Delete pages for removed concepts.

**Monorepo**: create a separate wiki per app. Each wiki is independent with its own taxonomy.

---

## Step 5: Rebuild metadata

For single app:
```bash
npx @fabrick/cli rebuild-source-map
```

For monorepo (run once per app):
```bash
npx @fabrick/cli rebuild-source-map --wiki-path apps/api/.fabrick/wiki
npx @fabrick/cli rebuild-source-map --wiki-path apps/frontend/.fabrick/wiki
```

This writes `source-map.json` and `hashmap.json` to each wiki directory.

---

## Output checklist

- [ ] `.fabrick/wiki/index.md` (or per-app)
- [ ] `.fabrick/wiki/hashmap.json`
- [ ] `.fabrick/wiki/source-map.json`
- [ ] Category directories with `.md` pages
- [ ] Each page has valid frontmatter (slug, category, sources, related, updated)
- [ ] Each page has Related Pages section

Report written pages and any that could not be generated.
