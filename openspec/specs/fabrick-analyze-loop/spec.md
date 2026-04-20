## ADDED Requirements

### Requirement: Corpus managed via corpus.yaml
The loop SHALL read target repos from `applications/loop/corpus.yaml`.

#### Scenario: Corpus contains repo URLs only
- **WHEN** `corpus.yaml` is read
- **THEN** each entry has only `url` — no stack, expected values, or hints

#### Scenario: New repo added to corpus
- **WHEN** user adds URL to `corpus.yaml`
- **THEN** next `loop-run` includes that repo

---

### Requirement: Runner clones and analyzes each repo
`loop-run` SHALL clone each corpus repo, execute `fabrick-analyze`, and store output.

#### Scenario: Output stored per run per repo
- **WHEN** `loop-run` completes for a repo
- **THEN** output written to `benchmarks/<run-id>/<repo-name>/output/` (copy of `.fabrick/context/`)

#### Scenario: Failed analyze logged, loop continues
- **WHEN** `fabrick-analyze` fails on a repo
- **THEN** failure logged to `benchmarks/<run-id>/<repo-name>/error.txt`, loop continues with next repo

---

### Requirement: Evaluation uses Q&A accuracy metric
`loop-eval` SHALL measure whether context is sufficient for downstream agent to answer questions about the repo.

#### Scenario: Ground truth Q&A generated from raw code
- **WHEN** eval starts for a repo
- **THEN** Sonnet reads raw code and generates question-answer pairs covering technical, product, and architectural questions

#### Scenario: Context-only answers scored against ground truth
- **WHEN** ground truth exists
- **THEN** Sonnet reads ONLY `.fabrick/context/` (not raw code) and answers same questions; answers compared to ground truth; score computed per category

#### Scenario: Eval calls use Batch API
- **WHEN** eval runs across corpus
- **THEN** all Sonnet calls submitted as Claude Batch API requests (async, 50% cost reduction)

#### Scenario: Scores stored per repo
- **WHEN** eval completes for a repo
- **THEN** `benchmarks/<run-id>/<repo-name>/scores.yaml` contains per-category scores and overall score

---

### Requirement: Improvement runs after each batch of 3–5 repos
`loop-improve` SHALL trigger after accumulating failures from a batch, not after every single repo.

#### Scenario: Improve triggers on batch completion
- **WHEN** 3–5 repos evaluated in current iteration
- **THEN** `loop-improve` runs with all failure cases from the batch as input

#### Scenario: Opus generates section-level patch only
- **WHEN** `loop-improve` runs
- **THEN** Opus receives current SKILL.md section + failure cases and returns patch for that section only — not full rewrite

#### Scenario: Hard conflicts logged when unresolvable
- **WHEN** 3 consecutive patch attempts for same section fail regression check
- **THEN** conflict logged to `benchmarks/<run-id>/summary.yaml` as `hard_conflicts` entry; section skipped

---

### Requirement: Regression protection on every improvement
After each SKILL.md patch, full corpus re-run MUST pass before patch is accepted.

#### Scenario: Patch rejected on metric regression
- **WHEN** any score category drops >5% compared to previous run baseline
- **THEN** patch rejected; previous SKILL.md restored

#### Scenario: Patch accepted on improvement
- **WHEN** all categories hold or improve vs baseline
- **THEN** SKILL.md committed with run-id reference

---

### Requirement: Loop stops at score plateau
The loop SHALL detect when skill improvement has stalled and stop automatically.

#### Scenario: Plateau detected
- **WHEN** overall score improves <2% over the last full iteration
- **THEN** loop terminates and prints summary

---

### Requirement: Benchmark history tracked
All runs SHALL be recorded in a persistent history file.

#### Scenario: History updated after each run
- **WHEN** `loop-eval` completes
- **THEN** `benchmarks/history.yaml` appended with run-id, date, SKILL.md version, and per-category scores

#### Scenario: Score trend visible across runs
- **WHEN** `history.yaml` read
- **THEN** metric progression readable as time series
