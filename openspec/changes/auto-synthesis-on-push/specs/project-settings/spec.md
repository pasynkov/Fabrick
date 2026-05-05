## MODIFIED Requirements

### Requirement: Auto-synthesis flag in project DTO
The project DTO SHALL include an `autoSynthesisEnabled` field that controls whether synthesis is triggered automatically on `fabrick push`.

#### Scenario: Project settings retrieved
- **WHEN** project settings are retrieved
- **THEN** response includes `autoSynthesisEnabled` boolean field

#### Scenario: Auto-synthesis flag updated
- **WHEN** PUT request is made to the project settings endpoint with `autoSynthesisEnabled` value (alongside name and api key)
- **THEN** system updates the flag and returns the updated project settings
