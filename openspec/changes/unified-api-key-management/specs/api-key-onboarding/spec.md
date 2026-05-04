## ADDED Requirements

### Requirement: Guided API key setup flow for organizations
The system SHALL provide a guided setup flow for organization administrators to configure their Anthropic API key with contextual help, validation feedback, and setup verification.

#### Scenario: First-time organization API key setup
- **WHEN** an organization admin accesses the API key setup for the first time
- **THEN** the system displays a guided wizard with step-by-step instructions for obtaining and configuring an Anthropic API key

#### Scenario: API key validation during setup
- **WHEN** an organization admin enters an API key during the setup flow
- **THEN** the system validates the key format in real-time and provides immediate feedback on validity

#### Scenario: Setup completion confirmation
- **WHEN** an organization admin completes the API key setup successfully
- **THEN** the system displays a confirmation message and offers to test the key with a sample synthesis operation

### Requirement: Project-level API key guidance and inheritance explanation
The system SHALL provide clear guidance on project-level API key configuration with explanations of inheritance hierarchy and when project-specific keys are beneficial.

#### Scenario: Project API key setup with inheritance explanation
- **WHEN** a user accesses project API key settings
- **THEN** the system displays the current inheritance status (using org key vs project-specific key) with clear explanations

#### Scenario: Project-specific API key recommendation
- **WHEN** a user considers setting a project-specific API key
- **THEN** the system provides guidance on scenarios where project keys are beneficial (cost tracking, different tiers, isolation)

### Requirement: Error resolution and troubleshooting guidance
The system SHALL provide contextual troubleshooting help for common API key configuration issues including invalid keys, missing permissions, and resolution failures.

#### Scenario: Invalid API key troubleshooting
- **WHEN** a user encounters an invalid API key error
- **THEN** the system provides specific guidance on obtaining valid Anthropic API keys with links to documentation

#### Scenario: Permission error resolution
- **WHEN** a user encounters permission errors during API key management
- **THEN** the system explains the required permissions and provides steps to resolve access issues

#### Scenario: Synthesis failure troubleshooting
- **WHEN** synthesis fails due to API key issues
- **THEN** the system provides clear diagnostic information and steps to resolve the configuration problem

### Requirement: Onboarding progress tracking and completion status
The system SHALL track user progress through the API key onboarding process and provide clear indicators of completion status and next steps.

#### Scenario: Onboarding progress visualization
- **WHEN** a user is in the API key onboarding process
- **THEN** the system displays progress indicators showing completed and remaining steps

#### Scenario: Onboarding completion status
- **WHEN** a user completes API key setup for their organization or project
- **THEN** the system updates the interface to show active status and removes onboarding prompts