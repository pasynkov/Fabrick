## ADDED Requirements

### Requirement: Sample capability exists for fixture
The fixture change SHALL declare a sample capability so the change tree validates.

#### Scenario: Capability is present
- **WHEN** the fixture change is inspected
- **THEN** `specs/sample-capability/spec.md` exists with at least one requirement and scenario
