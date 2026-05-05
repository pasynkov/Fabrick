## Job Deduplication Specification

### Requirements

1. System must detect duplicate jobs before queueing
2. Duplicate detection uses project_id + commit_sha as key
3. Only pending/in-progress jobs are considered duplicates
4. Users are notified when job is skipped due to duplication
5. Completed jobs do not block new jobs for same commit

### Implementation Details

- Deduplication check happens at queue submission time
- Check queries job state table for active jobs
- Duplicate detection applies to both auto and manual jobs
- Notification sent to user if duplicate is detected
