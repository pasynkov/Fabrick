## ADDED Requirements

### Requirement: Global ValidationPipe configuration
The system SHALL configure a global ValidationPipe in main.ts with whitelist, forbidNonWhitelisted, and transform options enabled.

#### Scenario: Global validation setup
- **WHEN** the NestJS application bootstraps
- **THEN** ValidationPipe is configured globally with security and transformation options

#### Scenario: Property whitelisting
- **WHEN** a client sends request with properties not defined in DTO
- **THEN** the system strips unknown properties and processes only whitelisted fields

#### Scenario: Non-whitelisted property rejection
- **WHEN** forbidNonWhitelisted is enabled and client sends unknown properties
- **THEN** the system returns HTTP 400 with validation error listing forbidden properties

### Requirement: Standardized validation error format
The system SHALL use NestJS default ValidationPipe error format for consistent error responses across all endpoints.

#### Scenario: Single field validation error
- **WHEN** validation fails for one field
- **THEN** the system returns HTTP 400 with error object containing field name, value, and constraint details

#### Scenario: Multiple field validation errors
- **WHEN** validation fails for multiple fields
- **THEN** the system returns HTTP 400 with error array containing all validation failures

#### Scenario: Nested object validation error
- **WHEN** validation fails for nested DTO properties
- **THEN** the system returns HTTP 400 with hierarchical error structure showing nested field paths

### Requirement: Type transformation configuration
The system SHALL enable automatic type transformation to convert string inputs to appropriate types based on DTO property decorators.

#### Scenario: String to number transformation
- **WHEN** DTO expects number and client sends numeric string
- **THEN** the system automatically transforms string to number

#### Scenario: String to boolean transformation
- **WHEN** DTO expects boolean and client sends "true"/"false" string
- **THEN** the system automatically transforms string to boolean

#### Scenario: Transformation failure handling
- **WHEN** string cannot be transformed to expected type
- **THEN** the system returns HTTP 400 with type validation error

