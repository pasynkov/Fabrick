## ADDED Requirements

### Requirement: Hash-based API key change detection
The settings forms SHALL store the initial API key hash on page load and compare it with the form state to determine if the API key field should be included in update requests. If the hash matches the initial state, the API key SHALL NOT be included in the update payload.

#### Scenario: API key unchanged - excluded from update
- **WHEN** user saves settings without modifying the API key field
- **THEN** anthropicApiKey field is excluded from the update request payload

#### Scenario: API key modified - included in update
- **WHEN** user modifies the API key field and saves
- **THEN** anthropicApiKey field is included in the update request payload

#### Scenario: Hash comparison prevents accidental key loss
- **WHEN** user updates other settings without touching API key field
- **THEN** existing API key is preserved and not overwritten with empty value

### Requirement: Form state hash tracking
The settings forms SHALL maintain hash state variables to track the initial API key hash and current form state for comparison during form submission.

#### Scenario: Initial hash stored on form load
- **WHEN** settings form loads
- **THEN** current API key hash is stored for later comparison

#### Scenario: Hash comparison during form submission
- **WHEN** form is submitted
- **THEN** current form state is compared against initial hash to determine inclusion in payload