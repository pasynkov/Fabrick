## ADDED Requirements

### Requirement: Queue auto-triggered synthesis jobs
The system SHALL queue synthesis jobs triggered by push events using the existing NATS/Service Bus infrastructure.

#### Scenario: Auto-synthesis job queued
- **WHEN** auto-synthesis trigger determines synthesis is needed
- **THEN** system queues job with auto-trigger metadata

#### Scenario: Queue message includes trigger source
- **WHEN** synthesis job is queued from auto-trigger
- **THEN** message includes trigger_source: "github_push" and commit details

### Requirement: Prioritize manual vs auto-triggered jobs
The system SHALL implement job prioritization with manual synthesis jobs having higher priority than auto-triggered jobs.

#### Scenario: Manual job processed first
- **WHEN** both manual and auto-triggered jobs are in queue
- **THEN** manual jobs are processed before auto-triggered jobs

#### Scenario: Auto-triggered jobs processed in order
- **WHEN** only auto-triggered jobs are in queue
- **THEN** jobs are processed in first-in-first-out order

### Requirement: Handle job deduplication
The system SHALL prevent duplicate synthesis jobs for the same project and commit combination.

#### Scenario: Duplicate commit synthesis prevented
- **WHEN** synthesis job is queued for project and commit already being processed
- **THEN** system skips queueing duplicate job

#### Scenario: Different commits allowed
- **WHEN** synthesis job is queued for same project but different commit
- **THEN** system allows both jobs to be queued

### Requirement: Job retry and failure handling
The system SHALL implement retry logic and failure handling for auto-triggered synthesis jobs.

#### Scenario: Transient failure retried
- **WHEN** auto-triggered synthesis job fails with retriable error
- **THEN** system retries job up to configured maximum attempts

#### Scenario: Permanent failure handled
- **WHEN** auto-triggered synthesis job fails permanently
- **THEN** system logs failure and moves to dead letter queue

### Requirement: Queue monitoring and metrics
The system SHALL provide monitoring capabilities for auto-synthesis queue health.

#### Scenario: Queue depth monitored
- **WHEN** auto-synthesis jobs are queued
- **THEN** system tracks queue depth metrics

#### Scenario: Processing time tracked
- **WHEN** auto-synthesis jobs are processed
- **THEN** system tracks job processing duration metrics