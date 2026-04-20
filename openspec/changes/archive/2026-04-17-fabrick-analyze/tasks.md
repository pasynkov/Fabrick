## 1. Skill Scaffold

- [x] 1.1 Create `.claude/skills/fabrick-analyze/SKILL.md`
- [x] 1.2 Write skill header: purpose, when to invoke, what it produces

## 2. Config Setup

- [x] 2.1 Create `.fabrick/` directory in target repo (if not exists)
- [x] 2.2 Write `.fabrick/config.yaml` with `project` and `repo` set to current folder name
- [x] 2.3 Create `.fabrick/context/` directory

## 3. Rule-Based Extraction

- [x] 3.1 Detect framework: check `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` → write `meta.yaml`
- [x] 3.2 Find route/controller files → extract HTTP method + path patterns → write `endpoints.yaml`
- [x] 3.3 Grep codebase for env var access patterns (`process.env.X`, `os.getenv`, etc.) → write `envs.yaml` (names only)
- [x] 3.4 Parse package manager manifest → write `dependencies.yaml`

## 4. Claude Analysis

- [x] 4.1 Collect top ~20 key files: entry points, route/controller files, service files (skip files >200 lines or binary)
- [x] 4.2 Feed files to Claude → write `overview.md` (what the app does, ~1 page)
- [x] 4.3 Feed files to Claude → write `logic.md` (key business flows from code)

## 5. Verification

- [x] 5.1 Run skill in a sample Node.js project → all 6 context files produced
- [x] 5.2 Confirm `envs.yaml` contains no secret values
- [x] 5.3 Confirm `logic.md` references actual code patterns, not README
