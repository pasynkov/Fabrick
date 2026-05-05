## ADDED Requirements

### Requirement: Process auto-triggered synthesis jobs
The synthesis service SHALL process jobs triggered by `fabrick push` with the same quality as manual triggers.

#### Scenario: Auto-triggered job processed normally
- **WHEN** synthesis service receives auto-triggered job from queue
- **THEN** service processes job using standard synthesis workflow
