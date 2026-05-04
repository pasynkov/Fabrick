## ADDED Requirements

### Requirement: API key format validation on form save
The system SHALL validate the Anthropic API key format when the settings form is submitted. Validation SHALL check that the key starts with the `sk-ant-` prefix.

#### Scenario: Valid API key format
- **WHEN** a settings form is submitted with an API key value of `sk-ant-abc123xyz...`
- **THEN** validation passes and the form submission proceeds to save the settings

#### Scenario: Invalid API key format - missing prefix
- **WHEN** a settings form is submitted with an API key value that does not start with `sk-ant-`
- **THEN** validation fails and the form displays an error message: "API key must start with sk-ant-"

#### Scenario: Empty API key field
- **WHEN** a settings form is submitted with an empty or whitespace-only API key field
- **THEN** validation passes (empty is allowed to clear the key) and the form proceeds to save with no API key

#### Scenario: API key with leading/trailing whitespace
- **WHEN** a settings form is submitted with an API key that has leading or trailing whitespace
- **THEN** the system trims whitespace and validates the resulting value
