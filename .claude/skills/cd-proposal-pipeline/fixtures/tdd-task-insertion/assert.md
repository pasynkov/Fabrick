# Assertions

Hand `input-tasks.md` to `proposal-reviewer` in mode 4 (scoped to a fictitious change directory containing only that tasks.md). After the agent runs, read `tasks.md` and assert:

1. Every behavioural implementation task is preceded by a test task in the same section.
   - "behavioural" = adds/changes runtime behaviour (endpoints, UI components, feature-flag gating, etc).
2. Mechanical tasks in section 3 carry the `[no-test]` flag with a one-line rationale in parentheses.
3. The agent's reply (the `REVIEW: <change-name>` block) contains a line beginning with `TDD insertions:` listing every inserted task's number.
4. No existing behavioural task was removed; insertions are additive.

A regression is: any assert above is false. Re-renumbering of subsequent tasks within a section is expected and required, not a regression.
