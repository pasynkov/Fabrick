## Job Prioritization Specification

### Requirements

1. Queue must support at least 3 priority levels
2. Scheduler must process jobs in descending priority order
3. Manual jobs must be processed before auto-triggered jobs
4. Priority level must be set at job creation time
5. Queue must track metrics by priority level

### Implementation Details

- Priority values: 1 (highest) to 3 (lowest)
- Scheduler polls queue in priority order
- Within same priority, FIFO ordering applies
- Scheduler configuration specifies batch sizes per priority level
