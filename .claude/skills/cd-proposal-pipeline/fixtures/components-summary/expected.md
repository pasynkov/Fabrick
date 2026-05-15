# Fixture expected: proposal-author summary block

```
CHANGE_NAME: add-project-token-analytics

Track per-project token usage and expose it on the landing dashboard.

- Surface monthly token totals per project on the landing dashboard.
- Add an analytics-aggregator worker producing rolled-up data.
- Add a Cosmos collection and a Grafana panel for the new metric.
- Gate CSV export behind a feature flag.

Constraint carried from the issue: CSV export stays behind a feature flag.

## Affected components
- Frontend: applications/landing
- Backend: services/api, services/analytics-aggregator
- Infra: infrastructure/cosmos.tf, infrastructure/grafana
```

(Exact wording will vary by run; the `## Affected components` block is the contract under test.)
