## Why

The `fabrick-analyze` skill is hand-crafted and manually improved. It has no feedback loop — failures on real repos go unnoticed and the skill never gets better. We need a pipeline that runs the skill against a diverse corpus of real repos, evaluates output quality using a meaningful downstream metric (Q&A accuracy), and uses those results to iteratively improve the skill with regression protection.

## What Changes

- New application: `applications/loop/` — Node.js CLI pipeline
- Corpus management via `corpus.yaml`
- Runner: clone repos, execute analyze, store output
- Evaluator: Q&A-based scoring using Claude Batch API (50% cost reduction)
- Optimizer: Opus-powered section-level SKILL.md patches
- Regression protection: reject patches that drop any metric >5%
- Benchmark storage: `applications/loop/benchmarks/<run-id>/`

## Capabilities

### New Capabilities

- `fabrick-loop-run`: Run analyze across all corpus repos, store outputs
- `fabrick-loop-eval`: Score outputs via Q&A evaluation using Batch API
- `fabrick-loop-improve`: Generate SKILL.md patches based on failure patterns, with regression check

## Loop Architecture

```
corpus.yaml
    │
    ▼
loop-run (per repo: clone → analyze → save to benchmarks/<run>/<repo>/output/)
    │
    ▼
loop-eval
  ├── Step 1: Sonnet reads RAW code → generates Q&A pairs (ground truth)
  ├── Step 2: fabrick-analyze runs → .fabrick/context/
  ├── Step 3: Sonnet reads ONLY context → answers same questions
  └── Step 4: compare answers → score per repo
  [all Sonnet calls via Batch API]
    │
    ▼
loop-improve (runs after every 3-5 new repos)
  ├── Opus reads: SKILL.md + top failure cases across batch
  ├── Generates: section-level patch (not full rewrite)
  ├── Applies patch → re-runs corpus → regression check
  │   └── if any metric drops >5% → reject, retry with failure context
  └── On pass → commit SKILL.md
```

## Iteration Strategy

Batch-based, not per-repo:
- Iteration 1: repos [1-5] → collect failures → improve → regression [1-5]
- Iteration 2: repos [6-10] on new SKILL → collect failures → improve → regression [1-10]
- Stop when score plateau (no metric improves >2% over last iteration)

## Evaluation Metric

**Q&A Accuracy**: % of questions answerable correctly from `.fabrick/context/` alone.

Question categories:
- Technical: "What message broker does this service use?", "What env vars are required?"
- Product: "What is the token TTL?", "What currencies are supported?"
- Architectural: "What events does this service publish?"

Score breakdown:
```yaml
scores:
  technical: 0.82
  product: 0.61
  architectural: 0.74
  overall: 0.72
```

## Corpus Format

```yaml
# corpus.yaml
repos:
  - url: https://github.com/spring-projects/spring-petclinic
  - url: https://github.com/tiangolo/full-stack-fastapi-template
  - url: https://github.com/nestjs/nest
```

No `stack` or `expected_*` fields — skill detects everything, Q&A is ground truth.

## Benchmark Storage

```
applications/loop/benchmarks/
  <run-id>/
    <repo-name>/
      output/         # .fabrick/context/ copy
      qa_pairs.yaml   # ground truth Q&A from raw code
      scores.yaml     # per-category scores
    summary.yaml      # aggregate + delta vs previous run
  history.yaml        # metric trend across all runs
```

## Impact

- New directory: `applications/loop/`
- Reads and modifies: `.claude/skills/fabrick-analyze/SKILL.md`
- External: GitHub (clone repos), Claude Batch API (evaluation)
- Prerequisite: `fabrick-analyze-v2` merged first — loop starts with improved baseline skill
