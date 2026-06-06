# ADR-001: Fabrick incremental documentation pipeline

**Status:** Accepted (experimental — branch `experiment/incremental-lab`)
**Date:** 2026-06-06
**Scope:** Lab in `applications/incremental-lab/`. Production CLI: `fabrick`.

## Context

We need machine-maintained, evidence-linked documentation for multi-repo systems where:

- Code changes weekly (per-PR), docs must stay fresh
- Doc cost per PR must be cents, not dollars
- Each fact must trace to source (no hallucination)
- Users (humans and LLM agents) query docs across repos as one system
- The same machine that uses Claude Code daily already has a warm CC cache — exploit that

Two layers, two abstraction levels:

| Layer       | Source of truth      | Content kind                                   | Change cadence  |
|-------------|----------------------|------------------------------------------------|-----------------|
| **wiki**    | source code (1 repo) | facts: env vars, subjects, replicas, identifiers | per PR        |
| **synthesis** | wikis (≥ 2 repos)  | business narrative: WHY / WHAT / HOW + routing  | per quarter   |

## Decisions

### D1. Tree-sitter for code → symbols, git diff for change signal

Wiki layer uses `tree-sitter-typescript` + `tree-sitter-yaml` via our `src/extract/*` to lift code into structured symbols (class / method / field / decorator / signature / imports / location). `simpleGit` produces unified diffs as the LLM-facing change signal.

Per-language extractor (~250 lines per language). One extractor for many frameworks — language-specific tree-sitter node types are the only difference.

**Rejected alternatives:**
- AST per source LOC (no grammar coverage outside TS/YAML)
- Raw git-blob diff only (loses semantic structure — can't separate signature change from body refactor)

### D2. Bootstrap = LLM-derived routing rules per repo, stored locally

`fabrick bootstrap <repo>` runs ONE LLM call with:
- snapshot summary (decorator matrix: per-decorator file-pattern distribution + co-occurring imports)
- root project files (package.json, nest-cli.json, README, Dockerfile, etc.)
- a `bootstrap-routing` skill embedded as system prompt

LLM emits `routing-rules.json`: per-slug decorators (passing concentration thresholds: count ≥ 5 AND ≥ 80% in one file pattern OR always co-imported with a slug-specific external SDK), per-slug import paths, file-pattern globs, internal-libs list, plus a `project` section (language / framework / kind / apps[] / runCommands[] / summary).

Skill at `skills/bootstrap-routing/` is **copied INTO the target repo's `.fabrick/skills/`** so the repo can re-bootstrap without the lab. Framework hints (`nestjs.md`, `kustomize.md`, `_default.md`) live in the skill — adding a framework = drop a new `.md`, no code change.

Result on backend1: 38 decorators captured (after fixing the extractor to walk class_body decorator siblings), 9 external integration packages identified, 17 file patterns. One-time cost: ~$0.25.

### D3. Per-app scope detection for monorepos

`src/scope/monorepo.js` reads `nest-cli.json` `projects[]` for code monorepos and `kustomization.yaml` trees for GitOps. Each app gets its own wiki under `.fabrick/wiki/<scope-dir>/`. Without this, an `AppModule` symbol from each microservice collapses into one wiki page.

### D4. Fixed 4-page taxonomy per scope

`service.md` / `contracts.md` / `config.md` / `integrations.md`. Chosen over per-class wiki because:
- per-class generates 50+ pages per service → slow + costly
- 4 page slugs cover all consumer needs (deploy / API / runtime config / external deps)
- patches operate at slug granularity → tight diffs

### D5. Two-phase wiki patch (compute / apply)

Per scope per PR:

1. **compute** (sonnet, dev side) — input: unified diff + existing 4 pages. Output: human-readable patch document (REPLACE/ADD instructions per slug or "no changes"). Acts as audit trail (`_patch.md`).
2. **apply** (haiku, SDK side) — input: existing pages of CHANGED slugs only + patch instructions. Output: new page bodies.

**Why haiku for apply:** apply is mechanical execution of patch instructions; doesn't need reasoning. Cost drops ~50% with no measurable quality loss on this task.

**Per-slug compute tested and rejected:** 4 parallel compute calls per scope → ~2× cost (changed-file hunks duplicated across slug calls), same drift, more variance.

**Rejected: structured patch ops + deterministic apply.** Markdown is too prose-y for line-precise ops; LLM patches are reliably text-level only.

### D6. Evidence as inline markdown links

Every concrete claim in a wiki page MUST cite the source file as `[name](src/relative/path.ts)`. The prompt enforces this in both generate and patch. `scripts/check-evidence.js` validates resolution against the working tree — 304 links across our Nami test, 0 broken.

### D7. Synthesis = business narrative + wiki routing, NOT a container of facts

Initially treated synthesis like wiki: facts of facts. Drift was bad (avg 0.63 after 5 stacked patches) because LLM-generated wiki output is paraphrased and that paraphrase cascades.

Reframed: synthesis answers WHY / WHAT / HOW at the concept level and links to wiki for current facts (env vars, replicas, subjects). Most PRs leave synthesis untouched ("no changes"). Operational facts NEVER appear in synthesis text — only wiki links.

Result: drift dropped from 0.63 → 0.78 (equivalent on 2 of 4 topics, 0 contradictions). Cost dropped from $1.51 → $1.10 per 5-iter chain (pages shrank because facts moved to links).

### D8. Synthesis pages — 4 topics, NOT more

Tried splitting into 10 small topics for "vector-index-style" navigation. Drift REGRESSED to 0.42 — more pages = more independent surfaces for paraphrase drift to compound. Fat topics anchor the model in a complete system picture.

### D9. Frontmatter on every page (Claude-skill-compatible)

YAML frontmatter (`name`, `description`, `type: wiki|synthesis`, `repo|scope|slug|system|sha|updatedAt`). Stamped deterministically by the CLI — LLM never sees or writes it. Pages become self-describing skills agents can pick by `description` without opening.

### D10. Index pages auto-generated from frontmatter

Per-scope `index.md` and synthesis `index.md` are deterministic breadcrumbs assembled from each topic's `description`. Never sent to or written by the LLM.

### D11. Markdown extractor as filter, not source

`src/extract/markdown.js` lifts wiki/synthesis pages into structural symbols (section / bullet / table_row with `bodyHash` and `fingerprintHash = label + sorted link paths`). Synthesis patch detection uses `fingerprintHash` to skip paraphrase-only wiki changes. Compute prompts still receive full before+after page bodies — cutting them to symbol-diff alone tanked quality (0.51).

### D12. CC wrapper overhead handled by warm cache, NOT batching

Claude Code subprocess adds ~12.5K tokens of system instructions per call. ~10.7K is server-side cached after first warm call; subsequent calls within 1h on the same machine pay only ~$0.004 cache-read. We accept this — direct Anthropic SDK (`sk-ant-api03`) is the alternative but loses the subscription billing model.

`scripts/batch-test.js` compared parallel vs sequential vs stream-json multi-turn batching on identical workload: parallel wins on both cost and wall time (multi-turn accumulates context across turns → expensive). Current implementation: parallel subprocess per scope, no batching.

## Pipeline diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ONE-TIME PER REPO (~$0.25)                        │
└──────────────────────────────────────────────────────────────────────────┘

 source repo                              <repo>/.fabrick/
 ───────────                              ─────────────────
 src/, apps/, libs/, ... ──┐
 nest-cli.json ────────────┤
 package.json ─────────────┼─→ fabrick bootstrap ──→ skills/bootstrap-routing/  (copied)
 Dockerfile ───────────────┤        │                investigate/snapshot.json
 README ───────────────────┘        │                investigate/summary.json
                                    │                investigate/root-files.json
                       tree-sitter ─┤                routing-rules.json
                       (TS / YAML)  │                file-slug-map.json
                                    │                state.json (baselineSha=null)
                                    ▼
                          ┌──────────────────┐
                          │  LLM (sonnet)    │  reads skill + summary + root files
                          │  via Claude Code │  → emits routing-rules.json
                          └──────────────────┘
                                    │
                                    ▼
                          router.js (deterministic JS)
                          applies rules to snapshot
                          → file-slug-map.json


┌──────────────────────────────────────────────────────────────────────────┐
│                  WIKI GENESIS PER REPO (~$0.40–0.70)                    │
└──────────────────────────────────────────────────────────────────────────┘

 fabrick fullscan <repo>
       │
       ├─→ detectScopes()  ─→  [{ name, root, kind }] per app/lib
       │
       └─→ per scope (parallel × N):
             buildSnapshot()  ─→  files + symbols (tree-sitter)
             generateAppScope(sonnet)
                   │
                   ▼
             4 page bodies emitted in one call
                   │
                   ▼
             stampFrontmatter()   (name, description, sha, ...)
                   │
                   ▼
             write .fabrick/wiki/<scope>/{service,contracts,config,integrations}.md
                   │
                   ▼
             buildScopeIndex() + buildRepoIndex()   (deterministic breadcrumbs)

       state.json.baselineSha = HEAD


┌──────────────────────────────────────────────────────────────────────────┐
│                      WIKI PATCH PER PR (~$0.10–0.30 / repo)             │
└──────────────────────────────────────────────────────────────────────────┘

 fabrick patch <repo>
       │
       └─→ per scope (parallel × N):
             git diff baselineSha..HEAD -- <scope.root>
                   │
                   ▼
             filterDiff()  ─ drop explicit-skip files (*.spec.ts, index.ts)
                   │
                   ▼
             readExistingPages()  ─ strip frontmatter before LLM
                   │
                   ▼
        ┌──────────────────────────────────────────┐
        │ computePatch(sonnet)                     │
        │   in:  unified diff + 4 existing pages   │
        │   out: patch.md (REPLACE/ADD per slug)   │
        └──────────────────────────────────────────┘
                   │
                   ▼
             allNoOp? ──yes──→ skip (just bump state)
                   │
                   no
                   ▼
        ┌──────────────────────────────────────────┐
        │ applyPatch(haiku)                        │
        │   in:  existing pages of CHANGED slugs   │
        │        + patch.md                        │
        │   out: new page bodies                   │
        └──────────────────────────────────────────┘
                   │
                   ▼
             stampFrontmatter() + write .fabrick/wiki/<scope>/<slug>

       state.json.baselineSha = HEAD


┌──────────────────────────────────────────────────────────────────────────┐
│                   CROSS-REPO SYNTHESIS (~$0.15–0.30 / run)              │
└──────────────────────────────────────────────────────────────────────────┘

 fabrick synthesize <out> --repos=r1,r2
       │
       │  load each repo's .fabrick/wiki/* + project meta
       │  (strip frontmatter; bundle as input)
       │
       ├── baseline-wiki/ snapshot exists? ──no──┐
       │                                          │
       │                                       GENESIS (sonnet, 1 call)
       │                                          │  emits 4 topic pages:
       │                                          │  system / data-flows /
       │                                          │  transport-graph / infra
       │                                          ▼
       │                                       linkRewriter (post-process)
       │                                          │  fixes any src-path leaks
       │                                          │  via per-repo file-slug-map
       │                                          ▼
       │                                       stampFrontmatter()
       │                                          ▼
       │                                       writeAutoIndex()
       │
       └── baseline-wiki/ exists? ──yes──┐
                                          │
                                  diff baseline-wiki vs current wiki
                                  per page: extractMarkdownSymbols()
                                            diffMarkdownFingerprints()
                                  skip pages whose fingerprintHash unchanged
                                            │
                                            ▼
                                  computeSynthesisPatch (sonnet, 1 call)
                                    in:  4 existing topics + full bodies of
                                         changed wiki pages + symbol-counts hint
                                    out: per-topic patch.md
                                            │
                                            ▼
                                  applySynthesisPatch (haiku, 1 call)
                                    in:  affected topics + patch instructions
                                    out: new topic bodies
                                            │
                                            ▼
                                  linkRewriter + stampFrontmatter + writeAutoIndex
                                  refresh baseline-wiki/


┌──────────────────────────────────────────────────────────────────────────┐
│                       QUERY / RESOLVE (per question)                    │
└──────────────────────────────────────────────────────────────────────────┘

 user question
       │
       ▼
 search agent loop  (sonnet via SDK or CC)
   tools available:
     list_categories        → unique scope names
     list_in(category)      → pages in scope
     page_meta(slug)        → frontmatter only
     read_page(slug)        → full body
     read_pages(slugs[])    → batch
     read_related(slug, d)  → follow markdown links
       │
       ▼
 agent picks ENTRY POINT:
   broad architectural Q  →  reads synthesis/system.md first
   specific fact Q        →  reads wiki/<scope>/<slug>.md
   cross-cutting Q        →  reads synthesis/transport-graph.md,
                             then drills into wiki via [link](repos/...)
       │
       ▼
 BRIEF: 2-5 sentence answer
 SOURCES: slug, slug, slug

 (validated on Nami iter 0/3/5: answers correctly reflect timeline —
  Kafka→GCS+BigQuery refactor, GCP env var addition, replicas bump,
  NATS connection registration introduction)
```

## Technologies

| Concern                       | Tech                                              |
|-------------------------------|---------------------------------------------------|
| Code AST                      | `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-yaml` |
| YAML config                   | `js-yaml`                                         |
| Git access                    | `simple-git`                                      |
| LLM driver                    | Claude Code CLI (`claude -p`) with `--system-prompt`, `--tools ""`, `--disable-slash-commands`, `--settings {enabledPlugins:{caveman:false}}` |
| Compute model (wiki/synthesis)| `claude-sonnet-4-6`                              |
| Apply model (wiki/synthesis)  | `claude-haiku-4-5`                               |
| Search model (consumer)       | `claude-sonnet-4-6`                              |
| Page format                   | Markdown + YAML frontmatter                       |
| Skill format                  | Claude-skill compatible (`SKILL.md` + frontmatter)|

## State layout

```
<repo>/.fabrick/
  skills/bootstrap-routing/    SKILL.md + detect.md + frameworks/*.md  (copied from lab)
  investigate/                 snapshot.json, summary.json, root-files.json, sample-symbols.json, by-kind/, decorators.txt, imports.txt
  routing-rules.json           LLM-derived rules
  file-slug-map.json           deterministic mapping (router.js applies rules to snapshot)
  state.json                   baselineSha, scopes[], project meta
  wiki/<scope-dir>/            service.md, contracts.md, config.md, integrations.md, index.md, _patch.md, _compute.* / _apply.*
  history/iter-N/wiki/         (replay artefacts for benches)

<system>/.fabrick-synthesis/   (separate dir, can live anywhere)
  index.md, system.md, data-flows.md, transport-graph.md, infra.md
  _baseline-wiki/<repoName>/   wiki snapshot at last synthesis run
  _meta.json, _compute.*, _apply.*, _patch.md, _synthesis.*
  history/iter-N/              (replay artefacts)
```

## Cost & quality numbers (Nami: backend1 6 NestJS scopes + kustomize 5 scopes)

| Phase                              | Cost            | Quality                           |
|------------------------------------|-----------------|-----------------------------------|
| bootstrap (per repo, 1-time)       | $0.25           | NestJS framework detected, 9 external integrations, 17 file patterns |
| wiki fullscan (per repo, 1-time)   | $0.40 – $0.70   | ~150 source-file links per repo, 0 broken |
| wiki patch (per PR, per repo)      | $0.10 – $0.30   | judge avg 0.85–0.92 per page      |
| synthesis genesis                  | $0.17           | 4 topics, ~225 lines, 0 broken links |
| synthesis patch (chain of 5)       | $1.10 total     | drift avg 0.78, 0 contradictions  |
| search query (5 questions × 3 iters) | $0.56         | answers correctly reflect timeline |

Cumulative one-time cost to stand up Nami documentation: **$1.40** (2 bootstraps + 2 fullscans + 1 synthesis genesis).
Per-PR run cost: **$0.20 – $0.50** (1–2 repos touched + 1 synthesis update).

## Open questions

1. **Multi-language repos.** Python / Java / Go extractors not yet written. Architecture supports them (same symbol shape, framework skill per ecosystem).
2. **MCP server exposing wiki + synthesis to agents.** Pages already self-describe via frontmatter — MCP wrapper would expose the search loop as a tool. Out of lab scope.
3. **Synthesis drift floor.** 0.78 is acceptable but not great. Next reductions probably require: (a) structured "facts" sidecar in wiki that synthesis reads deterministically, OR (b) just rebuild synthesis on every run (cost ≈ patch cost anyway).
4. **CI integration.** Fabrick currently runs manually. Per-PR hook (post-merge to main) would patch wiki + synthesis automatically. Latency budget ~60s.
