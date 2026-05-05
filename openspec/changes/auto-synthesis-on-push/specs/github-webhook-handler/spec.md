## ADDED Requirements

### Requirement: Accept GitHub push webhooks
The system SHALL accept GitHub webhook HTTP POST requests at `/api/webhooks/github` endpoint.

#### Scenario: Valid webhook is received
- **WHEN** GitHub sends a push event webhook with valid signature
- **THEN** system returns HTTP 200 and processes the event

#### Scenario: Invalid signature is rejected
- **WHEN** webhook is received with invalid or missing signature
- **THEN** system returns HTTP 401 and logs security warning

### Requirement: Verify webhook authenticity
The system SHALL verify GitHub webhook signatures using the configured webhook secret.

#### Scenario: Signature verification succeeds
- **WHEN** webhook signature matches computed HMAC-SHA256
- **THEN** webhook processing continues

#### Scenario: Signature verification fails
- **WHEN** webhook signature does not match computed HMAC-SHA256
- **THEN** webhook is rejected and security event is logged

### Requirement: Handle webhook event types
The system SHALL process only push events and ignore other GitHub webhook event types.

#### Scenario: Push event is processed
- **WHEN** webhook has event type "push"
- **THEN** system extracts repository and commit information

#### Scenario: Non-push events are ignored
- **WHEN** webhook has event type other than "push" (e.g., "pull_request")
- **THEN** system returns HTTP 200 but performs no processing

### Requirement: Extract repository information
The system SHALL extract repository owner, name, and commit details from push webhook payload.

#### Scenario: Repository details extracted
- **WHEN** push webhook is processed
- **THEN** system extracts repository.owner.login, repository.name, and head_commit.id

#### Scenario: Missing required fields handled
- **WHEN** webhook payload lacks required repository or commit fields
- **THEN** system returns HTTP 400 with error details

### Requirement: Idempotency handling
The system SHALL handle duplicate webhook deliveries by implementing idempotency based on delivery ID.

#### Scenario: First webhook delivery processed
- **WHEN** webhook with delivery ID is received for first time
- **THEN** system processes event and stores delivery ID

#### Scenario: Duplicate webhook delivery ignored
- **WHEN** webhook with previously seen delivery ID is received
- **THEN** system returns HTTP 200 but skips processing