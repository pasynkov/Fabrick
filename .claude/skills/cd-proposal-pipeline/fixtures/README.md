# Pipeline fixtures

Hand-driven regression inputs for the `cd-proposal-pipeline` skill and its subagents. Pre-prompt-test format: each fixture is a `*-input.md` + `*-expected.md` pair, plus an `assert.md` listing what the check looks for. Use them when iterating on `proposal-author.md`, `proposal-reviewer.md`, or `SKILL.md` to catch contract regressions before pushing.

## How to run

There is no automated harness — these are LLM-driven specs. To exercise a fixture:

1. Open a Claude Code session at the repo root.
2. Hand the input file to the relevant subagent (use the `Agent` tool with the right `subagent_type`).
3. Compare its reply to `*-expected.md`. The `assert.md` file lists what to compare. A run is failing iff any assert misses.

## Fixtures

- `components-summary/` — proposal-author summary block must contain `## Affected components` with tier lines.
- `tdd-task-insertion/` — proposal-reviewer (mode 4) must insert a missing test task above a behavioural implementation task.
