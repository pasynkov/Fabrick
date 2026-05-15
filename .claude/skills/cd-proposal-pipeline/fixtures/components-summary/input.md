# Fixture input: proposal-author summary block

The orchestrator calls `proposal-author` after fetching the issue thread. The simulated input to the author is the issue + the change-name decision context.

## Simulated issue thread (JSON, abridged)

```json
{
  "title": "Add per-project token usage analytics",
  "body": "We want to track tokens consumed per project per month. Surface a chart in the landing dashboard. Backed by the existing analytics service plus a new aggregation worker. Requires a new Cosmos collection and a Grafana panel.",
  "comments": [
    {
      "author": "pasynkov",
      "body": "Add an export-to-CSV button as well, but keep it behind a feature flag."
    }
  ]
}
```

Issue number: `123`

## Simulated post-author state

Assume `openspec-propose` has produced:

- `openspec/changes/add-project-token-analytics/proposal.md`
- `openspec/changes/add-project-token-analytics/tasks.md`
- `openspec/changes/add-project-token-analytics/specs/project-token-analytics/spec.md`

Touching: `applications/landing` (chart UI), `services/api` (read endpoint), a new `services/analytics-aggregator`, `infrastructure/cosmos.tf` (new collection), `infrastructure/grafana/` (panel).

## Author task

Return:

```
CHANGE_NAME: add-project-token-analytics

<summary block>
```

The summary block MUST end with an `## Affected components` section as documented in `.claude/agents/proposal-author.md`.
