## ADDED Requirements

### Requirement: Automatic synthesis triggering on events
The system SHALL automatically initiate synthesis jobs based on configurable project events without requiring manual user intervention.

#### Scenario: Push trigger activates synthesis
- **WHEN** a repository push occurs and project has an active PUSH_TRIGGER configured
- **THEN** synthesis job is published to the queue within 30 seconds

#### Scenario: Scheduled trigger activates synthesis
- **WHEN** scheduled time arrives for project with active SCHEDULE_TRIGGER
- **THEN** synthesis job is published to the queue within 60 seconds of scheduled time

#### Scenario: Trigger respects rate limiting
- **WHEN** trigger attempts to activate but project has exceeded rate limit (3 synthesis jobs per hour)
- **THEN** trigger is skipped and failure is logged with rate limit reason

### Requirement: Multiple trigger types per project
Projects SHALL support multiple simultaneous trigger configurations with independent activation conditions.

#### Scenario: Multiple triggers can coexist
- **WHEN** project has both PUSH_TRIGGER and SCHEDULE_TRIGGER configured
- **THEN** both triggers operate independently without conflict

#### Scenario: Trigger isolation
- **WHEN** one trigger type fails activation
- **THEN** other trigger types continue functioning normally

### Requirement: Trigger lifecycle management
The system SHALL manage trigger activation, deactivation, and cleanup based on project settings and system health.

#### Scenario: Trigger automatically deactivates on repeated failures
- **WHEN** trigger fails activation 5 consecutive times
- **THEN** trigger is automatically disabled and admin is notified

#### Scenario: Trigger respects project auto-synthesis setting
- **WHEN** project auto-synthesis is disabled
- **THEN** all automated triggers are suspended until re-enabled

### Requirement: Event source integration
The system SHALL integrate with repository push events and external scheduling systems to detect trigger conditions.

#### Scenario: Repository push event detection
- **WHEN** repository receives new commits via git push
- **THEN** push event is captured and evaluated against project PUSH_TRIGGER conditions

#### Scenario: Cron schedule evaluation
- **WHEN** system evaluates scheduled triggers every minute
- **THEN** projects with due SCHEDULE_TRIGGER have synthesis initiated