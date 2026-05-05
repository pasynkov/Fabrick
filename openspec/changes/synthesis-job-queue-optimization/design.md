## Architecture

### Job Prioritization

Jobs are assigned priority levels based on their trigger source:
- Priority 1 (High): Manual synthesis requests
- Priority 2 (Medium): Auto-triggered synthesis from artifact push
- Priority 3 (Low): Scheduled/retry synthesis

The queue scheduler processes jobs in priority order, ensuring manual requests are not delayed by automatic ones.

### Job Deduplication

When a new synthesis job is submitted, the system checks for existing pending/in-progress jobs for the same project and commit SHA. If found:
- New job is discarded if an identical job is already queued
- User receives notification that synthesis is already in progress
- Prevents duplicate processing of identical code states

### Enhanced Retry Logic

Auto-triggered jobs receive special retry handling:
- Automatic retries for transient failures (network, service unavailability)
- Exponential backoff strategy to reduce resource contention
- Manual jobs bypass enhanced retry (processed once)

### Monitoring and Metrics

Queue collects metrics on:
- Job throughput (jobs/minute by priority)
- Queue depth and wait times
- Deduplication effectiveness (duplicate attempts prevented)
- Retry success rates
- End-to-end job completion times

## Integration Points

- Synthesis service: Provides job submission and execution
- Background job processor: Consumes prioritized queue
- Monitoring system: Receives metrics and dashboards
