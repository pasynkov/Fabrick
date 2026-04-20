## Context

The synthesis skill runs locally against a folder of downloaded context files. It has no network dependencies — it just reads files and writes files. Claude does all the intelligence work.

## Goals / Non-Goals

**Goals:**
- Read all repo context folders from `downloaded/`
- Synthesize a unified architecture document in `architecture/`
- Structure output so Claude can answer questions by reading ONE file, not everything

**Non-Goals:**
- Fetching from MinIO (developer downloads manually)
- Real-time updates
- Diff/versioning of architecture docs

## Decisions

### Input convention
```
downloaded/
├── repo-frontend/
│   └── context/
│       ├── meta.yaml
│       ├── endpoints.yaml
│       └── ...
├── repo-backend/
│   └── context/
│       └── ...
└── repo-devops/
    └── context/
        └── ...
```

### Output structure — designed for directed navigation
```
architecture/
├── index.md              "to answer X, read Y" — the map
├── overview.md           what the whole system does, how apps relate
├── apps/
│   ├── {repo}.md         per-app: purpose, key flows, env vars, endpoints
│   └── ...
└── cross-cutting/
    ├── integrations.md   which app calls which, shared contracts
    └── envs.md           all env vars across all apps with descriptions
```

### index.md as navigation guide
The key design insight: `index.md` tells Claude which file to read for which type of question. Example:
```
## Navigation Guide
- Questions about frontend behavior → apps/repo-frontend.md
- Questions about API endpoints → apps/repo-backend.md
- Questions about env vars → cross-cutting/envs.md
- System overview → overview.md
```

This enables the search skill to read ONE file and answer correctly.

### Synthesis strategy
Claude reads all context files in one pass → writes all architecture files. Single synthesis run, not incremental.

## Risks / Trade-offs

- Large number of repos → might exceed context window → acceptable for PoC (3 repos is fine)
- Quality depends on quality of input context → good enough if analyze skill did its job
