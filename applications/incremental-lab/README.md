# incremental-lab

Sandbox for testing symbol-level incremental wiki rebuild. Goal: cheap analysis
and synthesis — only regenerate the wiki pages affected by a code change, not the
whole wiki.

This is a workspace for **testing the theory locally**. Nothing here ships to
production yet. If the experiment works, the engine moves into `@fabrick/cli`.

## Architecture

```
EVENT (git diff)
   ├─ extract:    file → symbols (tree-sitter)
   ├─ snapshot:   deterministic JSON of symbols + sourcemap
   ├─ diff:       snapshot Δ → {added, deleted, sigChanged, bodyChanged, importsChanged}
   ├─ invalidate: diff + sourcemap → pages to rebuild
   ├─ cascade:    aggressive consumer cascade (L2 default, breaking = unlimited)
   ├─ plan:       batched LLM calls (mock in V1)
   ├─ validate:   I1–I7 invariants
   └─ bench:      drift metric (full vs incremental)
```

Deterministic pieces are unit-tested. LLM is mocked in V1.

## Layout

```
src/
  extract/      tree-sitter symbol extraction
  snapshot/     stable JSON store
  diff/         symbol-level diff
  invalidate/   page invalidation
  cascade/      aggressive cascade rules
  validate/     invariants I1–I7
  bench/        drift metrics
test/
  unit/         pure-function unit tests
  fixtures/     micro-repo fixtures (baseline + change + expected.yaml)
  scenarios/    integration scenarios using fixtures
scripts/
  nami-snapshot.js   snapshot Nami corpus
  nami-simulate.js   synthesized commit generator (CI regression)
  nami-drift.js      real-history replay + drift metric
```

## Setup

```bash
cd applications/incremental-lab
npm install
cp .env.local.example .env.local
# edit .env.local with paths to your local Nami repos
npm test
```

## Tests

- `npm run test:unit` — fast deterministic unit tests
- `npm run test:fixtures` — integration tests on synthesized fixtures
- `npm run nami:drift` — drift metric on real Nami history (slow, manual)

## Cascade policy

Aggressive (chosen for high-value codebases):

| Change kind        | Cascade depth |
|--------------------|---------------|
| Signature change   | L2            |
| Type change        | L2            |
| Export removed     | unlimited     |
| Deleted file       | unlimited     |
| Body change only   | direct only   |
| New export         | direct + index|

## Invariants checked after rebuild

- I1. Every symbol mentioned in `.md` exists in code
- I2. Every `sourcemap` entry points to an existing file
- I3. All internal page links resolve
- I4. Frontmatter schema valid
- I5. No orphan pages (page with no live symbols)
- I6. `hashmap.json` consistent with real file hashes
- I7. Incremental result structurally equivalent to full rebuild
