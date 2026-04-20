## 1. Project Scaffold

- [x] 1.1 Create `applications/loop/` directory structure: `scripts/`, `benchmarks/`
- [x] 1.2 Init `package.json` with dependencies: `@anthropic-ai/sdk`, `simple-git`, `js-yaml`, `commander`
- [x] 1.3 Create `corpus.yaml` with empty repos list
- [x] 1.4 Create `benchmarks/history.yaml` with empty runs list

## 2. Runner: run.js

- [x] 2.1 Read corpus.yaml, iterate over repos
- [x] 2.2 Clone each repo to temp dir (shallow clone, `--depth 1`)
- [x] 2.3 Run fabrick-analyze skill in cloned repo via Claude Code CLI (`claude -p "..."`)
- [x] 2.4 Copy `.fabrick/context/` output to `benchmarks/<run-id>/<repo-name>/output/`
- [x] 2.5 On failure: write error to `benchmarks/<run-id>/<repo-name>/error.txt`, continue
- [x] 2.6 Generate run-id: `YYYY-MM-DD-NNN` format

## 3. Evaluator: evaluate.js

- [x] 3.1 For each repo in run: read raw source files (up to 30 key files)
- [x] 3.2 Build Batch API request: Sonnet prompt to generate Q&A pairs (technical + product + architectural questions)
- [x] 3.3 Build Batch API request: Sonnet prompt to answer same questions using ONLY `.fabrick/context/` output
- [x] 3.4 Submit both batches via Claude Batch API, poll for completion
- [x] 3.5 Compare answers: score per category (technical, product, architectural)
- [x] 3.6 Write `benchmarks/<run-id>/<repo-name>/qa_pairs.yaml` (ground truth)
- [x] 3.7 Write `benchmarks/<run-id>/<repo-name>/scores.yaml` (per-category + overall)
- [x] 3.8 Write `benchmarks/<run-id>/summary.yaml` (aggregate across all repos + delta vs prev run)
- [x] 3.9 Append to `benchmarks/history.yaml`

## 4. Improver: improve.js

- [x] 4.1 Read summary.yaml: identify lowest-scoring categories and failure cases
- [x] 4.2 Select top 5 failure cases (question + expected + actual answer)
- [x] 4.3 Parse SKILL.md into sections by `###` headings
- [x] 4.4 Identify which SKILL.md section is responsible for failed extractions
- [x] 4.5 Call Opus (sync): send section + failure cases → receive patched section
- [x] 4.6 Apply patch to SKILL.md (replace section only)
- [x] 4.7 Re-run full corpus with patched SKILL.md
- [x] 4.8 Compare new scores vs previous run baseline per repo per category
- [x] 4.9 If any category drops >5%: reject patch, restore SKILL.md, retry with failure context (max 3 attempts)
- [x] 4.10 If 3 attempts fail: log hard conflict to summary.yaml, skip section
- [x] 4.11 If pass: commit SKILL.md with run-id in commit message

## 5. Orchestrator: loop.js

- [x] 5.1 Accept CLI flags: `--corpus`, `--batch-size` (default 5), `--max-iterations`
- [x] 5.2 Split corpus into batches of `--batch-size`
- [x] 5.3 Per iteration: run → eval → improve → regression check
- [x] 5.4 Plateau check: if overall score improves <2% vs previous iteration → print summary and exit
- [x] 5.5 Print iteration summary after each cycle: scores delta, sections patched, hard conflicts

## 6. Verification

- [x] 6.1 Add 3 test repos to corpus.yaml (different stacks: Node, Python, Java)
- [ ] 6.2 Run `loop.js` for one full iteration end-to-end
- [ ] 6.3 Verify `benchmarks/<run-id>/` structure written correctly
- [ ] 6.4 Verify Q&A pairs generated and scored
- [ ] 6.5 Verify SKILL.md patched and committed on improvement
- [ ] 6.6 Verify regression rejection works: manually introduce a bad patch, confirm rollback

<!-- 6.2–6.6: manual verification — run: cd applications/loop && node scripts/loop.js --batch-size 3 --max-iterations 1 -->

