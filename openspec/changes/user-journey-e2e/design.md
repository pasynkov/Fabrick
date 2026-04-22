## Context

Unit and e2e integration tests cover individual components but not the full system. The user-journey test suite runs the complete Fabrick product flow against a real ephemeral Azure environment deployed specifically for testing on `release/*` branches. This suite is the final gate before merging to main.

## Goals / Non-Goals

**Goals:**
- Full flow test: register → org → repo → push context → trigger synthesis → poll → verify output
- Runs against real Azure (Functions API, PostgreSQL, Blob Storage, Service Bus, Container Apps)
- Integrated into staging workflow (cicd-pipeline change)
- Logs collected and uploaded as artifacts on failure

**Non-Goals:**
- UI/browser automation (Fabrick has no web UI beyond the console, which is out of scope)
- Performance/load testing
- Multi-user concurrency scenarios
- Testing CLI installation from npm (use local build)

## Decisions

### Test suite location and structure

```
tests/user-journey/
  package.json          ← standalone package, not part of monorepo workspaces
  jest.config.js        ← testTimeout: 180000 (synthesis can take 60-120s)
  src/
    journey.test.ts     ← main flow test
    helpers/
      api.ts            ← thin HTTP client wrapping fetch
      cli.ts            ← spawns @fabrick/cli binary via execa
      poll.ts           ← polling helper with configurable timeout
```

Standalone package (not in `applications/`) because it's a test harness, not a deployable artifact.

### How to drive the CLI

Use `execa` to spawn the CLI binary built from local source:

```ts
// helpers/cli.ts
import { execa } from 'execa';
const CLI = path.resolve(__dirname, '../../../applications/cli/bin/fabrick.js');

export const fabrick = (...args: string[]) =>
  execa('node', [CLI, ...args], { env: { FABRICK_API_URL: process.env.API_URL } });
```

**Why not API directly for everything?** CLI tests verify the CLI itself works (arg parsing, output format, credential storage). The journey is what a real user does.

### Synthesis polling

Synthesis is async — trigger returns 202, result available later. Poll `/repos/:id/synthesis/status` with exponential backoff:

```ts
// helpers/poll.ts
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  { maxAttempts = 20, intervalMs = 5000 } = {}
): Promise<T>
```

Max wait: 100s (20 attempts × 5s). If synthesis exceeds this → test fails with descriptive timeout message.

### Environment configuration

All config via env vars injected by the staging workflow:

```
API_URL=https://fabrick-api-<suffix>.azurewebsites.net
TEST_USER_EMAIL=journey-test@fabrick.local
TEST_USER_PASSWORD=<generated per run>
```

No hardcoded values. Staging workflow sets these from Terraform outputs.

### Log collection on failure

```yaml
# in staging.yml
- name: Collect logs on failure
  if: failure()
  run: |
    az monitor log-analytics query \
      --workspace $LOG_WORKSPACE_ID \
      --analytics-query "AppTraces | where TimeGenerated > ago(1h)" \
      -o table > logs/api.txt
    az containerapp logs show --name fabrick-synthesis ... > logs/synthesis.txt
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: journey-failure-logs
    path: logs/
```

### Test isolation

Each journey test run uses unique email (`journey-<uuid>@fabrick.local`) to avoid collision if runs overlap. `afterAll` calls API to delete test user and all associated data (requires admin endpoint or direct DB access via psql).

**Why not wipe DB?** Terraform destroy handles full cleanup. `afterAll` is just a best-effort cleanup during the run.

## Risks / Trade-offs

- **Synthesis flakiness** — Real Anthropic API calls in staging. If API is slow or returns unexpected output, test may fail. Mitigation: poll timeout generous (100s), assert structure not exact content.
- **Cold start** — Container App scales to 0. First synthesis job may wait 30-60s for cold start. Accounted for in poll timeout.
- **Azure credentials in CI** — Service principal needs read access to Log Analytics for log collection. Scope separately from deploy credentials if possible.
- **Cost per run** — Each staging run = full terraform apply + synthesis + destroy. Budget ~$0.50-1.00 per release branch push.
