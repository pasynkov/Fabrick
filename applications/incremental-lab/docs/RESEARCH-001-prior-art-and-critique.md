# RESEARCH-001: Prior art survey and architecture critique

**Date:** 2026-06-06
**Companion to:** [ADR-001](./ADR-001-fabrick-pipeline.md)
**Scope:** External comparison of Fabrick wiki + synthesis pipeline against published research and existing tools as of mid-2026.

## Comparison with existing solutions

### RepoAgent (arxiv 2402.16667)

LLM framework for repository-level documentation. Generates docs per-symbol (function/class), not per-page-taxonomy.

- **Advantage:** flexibility — no rigid 4-slug structure
- **Disadvantage:** 50+ pages per service → costlier, harder to navigate
- **Our take:** 4-slug taxonomy was the right call for consumability but is rigid for non-standard projects

### Codebase-Memory (arxiv 2603.27277, 2026)

Same core idea as ours: tree-sitter → knowledge graph → expose to LLM agents. Stores in SQLite knowledge graph, file watcher triggers incremental re-indexing. Exposes via **MCP server** (14 typed tools). Claims **10× token reduction + 2.1× fewer tool calls** vs baseline.

**We do not have:**
- MCP server (our skill format IS MCP-compatible — but no server)
- Graph storage (file-slug-map is flat JSON, not a queryable graph)
- File watcher (we run on command / CI hook)

### AST-derived vs LLM-extracted KG (arxiv 2601.08773)

Benchmark: AST-derived (tree-sitter) graphs **win** on indexing speed and reliability vs LLM-extracted KGs. Confirms our D1 choice.

### Bytebell Graph RAG

Multi-repo approach using lightweight code graph + vector search. **We use bundle-style** (send everything to prompt). Works at ~100 pages, does not scale to 10K+.

### Mintlify Agent

Auto-generates docs from OpenAPI specs + **proposes PRs** for doc changes when code ships. Closest commercial analogue to our patch flow.

**Key difference:** Mintlify requires **human review** before merge. We overwrite automatically. For compliance-critical projects (medical, fintech) we need a review-PR pattern.

### Sourcegraph Cody

Multi-repo RAG with code search. Does NOT generate docs — answers questions directly from code.

**Different philosophy:** Cody says "code IS the doc". We say "extract docs, query docs". For legacy / cross-team repos Cody is better; for onboarding / business docs our wiki+synthesis is right.

### Red Hat Code-to-Docs (GitHub Action, Apr 2026)

Two-stage semantic indexing: per-folder summaries → identify affected docs. **Same idea as our file-slug-map**. Confirms approach.

### Citation-grounded code comprehension (arxiv 2512.12117)

92 % citation accuracy with hybrid retrieval + graph reasoning, ZERO hallucinations on 30 Python repos / 180 queries.

**We hit 100 % locally** because we control link emission and validate via `scripts/check-evidence.js`. Our advantage: generate-time grounding, not post-hoc retrieval grounding.

### Anthropic Skills spec (anthropics/skills, GitHub)

Standardised SKILL.md format: YAML frontmatter (`name`, `description`) + markdown body. Bundled resources in `scripts/`, `references/`, `assets/`.

**We align:** our `skills/bootstrap-routing/SKILL.md` and `skills/synthesis/SKILL.md` follow the spec. **We deviate:** we bundle framework hints (`frameworks/nestjs.md`, `frameworks/kustomize.md`) as siblings — the model picks one. Standard says skills should be self-contained.

## Strengths of our pipeline

| # | Decision                                            | Status vs literature                  |
|---|-----------------------------------------------------|---------------------------------------|
| 1 | D5 — compute (sonnet) / apply (haiku) two-phase     | **Unique**; not found in literature   |
| 2 | D7 — synthesis as narrative + routing, not facts    | Ahead of Mintlify (only API docs)     |
| 3 | D9 — frontmatter as Claude-skill                    | Early adopter; Anthropic spec recent  |
| 4 | D13/D14 — cost-driven rebuild with token threshold  | **Not seen in literature**            |
| 5 | D6 — inline evidence links at generation time       | Higher accuracy than post-hoc (100 % vs 92 %) |

## Weaknesses

### 1. Bundle-based search does not scale

`scripts/search-test.js` sends entire wiki+synthesis bundle (~85 KB at iter 5) into prompt. Works at ~100 pages. Falls apart at 1000+.

**Fix:**
- Vector embedding index (sqlite-vss / chromadb local)
- Agentic loop with `read_page` (the existing `backend/shared/search.impl.ts` already does this — wire to our pages)
- MCP server wrapper

### 2. State.json is a single point of failure

`baselineSha` per repo, single value. Concurrent PR race: PR1 merges → patch → baseline=A. PR2 was based on pre-A, merges → patch sees diff A..B that re-includes PR1's changes.

**Fix:** per-scope or per-file SHA tracking, OR global lock in CI, OR eventually-consistent retry on conflict.

### 3. Patch preserves "do not delete" — bias toward staleness

Compute prompt says "DO NOT REMOVE existing factual details that are still accurate". Without explicit REMOVE in patch instructions, stale facts persist after code is removed. **Drift toward aggregation.** D13/D14 periodic rebuild partially fixes but not for all scopes.

### 4. Tree-sitter coverage — 2 languages only

TypeScript + YAML only. Each new language is ~250 LOC extractor + framework hint .md. Doesn't scale to mixed stacks (Node frontend + Python ML + Go scripts).

**Fix:** use tree-sitter `.scm` query files to slim each extractor to ~50 LOC.

### 5. Bootstrap = one-shot LLM call → permanent rules

Bad bootstrap → bad patches forever. No re-tuning mechanism. If the project gains a new framework, routing rules go stale.

**Fix:** `fabrick re-bootstrap --merge` that augments existing rules instead of overwriting.

### 6. Synthesis "always rebuild" makes the patch layer dead code

Dynamic threshold (D14) for synthesis effectively forces rebuild every iter. **The whole synthesis patch path could be deleted** (~150 LOC) and the CLI simplified. Architectural debt.

### 7. No deletion handling

Service removed from monorepo → its wiki is orphaned. Nothing cleans it.

**Fix:** `fabrick gc` or auto-cleanup of scope dirs not present in current `detectScopes()` output.

### 8. No human review loop

Wiki + synthesis are overwritten automatically. For compliance-critical projects (medical, fintech) we need a Mintlify-style PR-proposal pattern.

### 9. Single LLM provider

`claude-sonnet-4-6` / `claude-haiku-4-5` hard-coded. Vendor lock-in.

**Fix:** abstraction (Vercel AI SDK / LangChain / etc).

### 10. Frontmatter `updatedAt` causes false diffs

We stamp `updatedAt: <ISO>` on every generate. Causes git-diff-noise even when content unchanged → downstream consumers (git diff, MCP indexers) see false positives.

**Fix:** only update `updatedAt` when body content actually changed.

### 11. No semantic versioning

Frontmatter has `sha` but no `version`. Hard to find "wiki at v0.13.0". MCP consumers can't pin to a stable version.

### 12. Bundle in search-test bypasses agentic discovery

`backend/shared/search.impl.ts` is a proper agentic loop with `list_categories` / `read_page` / `read_related` tools. Our `search-test.js` bundles everything. We never validated the real agentic flow on our wiki structure.

**Fix:** wire our `.fabrick/wiki/` + `.fabrick-synthesis/` into the search.impl WikiRepository interface and run the same 5 questions through it.

### 13. Drift judge is subjective

LLM judge for drift score (avg 0.78). Reproducibility low — judge LLM has its own variance.

**Fix:** multiple judges + average, OR task-specific metrics (factual recall, link integrity, version freshness).

### 14. Cold cache not optimised in CI

Cold start = ~$0.014 wrapper. For frequent PR runs a long-running CI runner with warm cache amortises this. Not explored.

### 15. `.fabrick/history/` pollutes the repo

If committed → large artefacts in git. If gitignored → history snapshots lost across machines.

**Fix:** separate artefact store (object storage / dedicated branch with iter tag).

## Prioritised next steps

```
HIGH IMPACT
  1. MCP server wrapper around wiki+synthesis (Anthropic skill spec-compatible)
  2. Vector embedding index (sqlite-vss / chromadb) for search at scale
  3. Per-scope baseline SHA for concurrent-PR safety

MEDIUM
  4. Human review PR pattern (Mintlify-style) as opt-in
  5. Delete synthesis patch layer — D14 made it dead code
  6. updatedAt only on actual content change
  7. fabrick re-bootstrap --merge

LOW (cleanup)
  8. Deletion handling (fabrick gc)
  9. Multi-LLM abstraction
  10. Tree-sitter .scm queries for wider language support
```

## Conclusion

What we built:
- Wiki layer with deterministic source (tree-sitter) — matches or exceeds literature
- Inline evidence linking with validation — exceeds literature (100 % vs 92 %)
- Compute / apply phase split — unique
- Cost-driven rebuild with token threshold — practical, novel
- Skill-compatible frontmatter — early adopter

What we did not build (all known, all executable):
- Production-ready search (needs MCP + vector store)
- Multi-language support (TS + YAML only)
- Human-review loop
- Concurrent-PR safety

**Verdict:** architecturally solid for a lab / pilot. For production, the missing pieces are well-defined and each fits one of the next-steps above.

## Sources

- [RepoAgent: LLM-Powered Framework for Repository-level Code Documentation Generation](https://arxiv.org/pdf/2402.16667)
- [Codebase-Memory: Tree-Sitter-Based Knowledge Graphs for LLM Code Exploration via MCP](https://arxiv.org/pdf/2603.27277)
- [Reliable Graph-RAG for Codebases: AST-Derived Graphs vs LLM-Extracted Knowledge Graphs](https://arxiv.org/abs/2601.08773)
- [The Simple Graph RAG Strategy That Finally Makes Multi-Repository Code Changes Reliable (Bytebell)](https://bytebell.ai/blog/simple-graph-rag/)
- [Mintlify — Best AI Documentation Tools in 2026](https://www.mintlify.com/library/best-ai-documentation-tools)
- [Sourcegraph Cody Documentation](https://sourcegraph.com/docs/cody)
- [Red Hat: AI-powered documentation updates from code diff to docs PR](https://developers.redhat.com/articles/2026/04/21/ai-powered-documentation-updates-code-diff-docs-pr-one-comment)
- [Citation-Grounded Code Comprehension (arxiv 2512.12117)](https://arxiv.org/abs/2512.12117)
- [Anthropic: Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Agent Skills Specification (Anthropic)](https://github.com/anthropics/skills)
- [Bringing the LLM Wiki Idea to a Codebase (DEV)](https://dev.to/yysun/bringing-the-llm-wiki-idea-to-a-codebase-22go)
- [Does My README File Need To Be Updated? Exploring LLM-Based README Maintenance (arxiv 2603.00489)](https://arxiv.org/pdf/2603.00489)
- [Automated and Context-Aware Code Documentation Leveraging Advanced LLMs (arxiv 2509.14273)](https://arxiv.org/pdf/2509.14273)
- [SemanticDiff — Language Aware Diff For VS Code & GitHub](https://semanticdiff.com/)
- [optave/ops-codegraph-tool — code intelligence CLI](https://github.com/optave/ops-codegraph-tool)
- [Glean × Confluence integration](https://www.glean.com/connectors/confluence)
