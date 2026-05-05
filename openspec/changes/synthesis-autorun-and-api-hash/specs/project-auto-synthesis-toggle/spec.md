## ADDED Requirements

### Requirement: Auto-synthesis toggle in project settings UI
The console project settings page SHALL display a toggle control labeled "Run synthesis automatically on context update" that controls the autoSynthesisEnabled project field. The toggle SHALL default to false and include help text explaining the feature.

#### Scenario: Toggle displayed on settings page
- **WHEN** user visits the project settings page
- **THEN** auto-synthesis toggle is displayed with appropriate labeling and help text

#### Scenario: Toggle reflects current project state
- **WHEN** project has autoSynthesisEnabled set to true
- **THEN** toggle is displayed in enabled state

#### Scenario: User enables auto-synthesis
- **WHEN** user toggles auto-synthesis from disabled to enabled and saves
- **THEN** project autoSynthesisEnabled field is updated to true

#### Scenario: User disables auto-synthesis
- **WHEN** user toggles auto-synthesis from enabled to disabled and saves
- **THEN** project autoSynthesisEnabled field is updated to false

### Requirement: Auto-synthesis help text
The auto-synthesis toggle SHALL include clear explanatory text that indicates synthesis will run automatically after CLI push operations when enabled, with default state being disabled.

#### Scenario: Help text displayed
- **WHEN** user views the project settings page
- **THEN** help text explains that synthesis runs automatically after CLI pushes when enabled