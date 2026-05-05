## ADDED Requirements

### Requirement: Process auto-triggered synthesis jobs
The synthesis service SHALL process jobs triggered by GitHub push events with the same quality as manual triggers.

#### Scenario: Auto-triggered job processed normally
- **WHEN** synthesis service receives auto-triggered job from queue
- **THEN** service processes job using standard synthesis workflow

#### Scenario: Trigger source metadata preserved
- **WHEN** auto-triggered job is processed
- **THEN** synthesis output includes metadata about trigger source and commit

### Requirement: Handle commit-specific context
The synthesis service SHALL use commit-specific repository context when processing auto-triggered jobs.

#### Scenario: Commit SHA used for context
- **WHEN** auto-triggered job includes commit SHA
- **THEN** synthesis service reads repository context at that specific commit

#### Scenario: Latest context used as fallback
- **WHEN** auto-triggered job lacks commit SHA
- **THEN** synthesis service uses latest available context

### Requirement: Auto-synthesis output differentiation
The synthesis service SHALL mark outputs from auto-triggered jobs to distinguish them from manual synthesis.

#### Scenario: Auto-synthesis output tagged
- **WHEN** synthesis completes for auto-triggered job
- **THEN** output includes trigger_type: "auto" and timestamp metadata

#### Scenario: Manual synthesis output tagged
- **WHEN** synthesis completes for manually triggered job
- **THEN** output includes trigger_type: "manual" and user information