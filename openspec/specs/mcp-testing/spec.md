### Requirement: Unit tests cover MCP tool handlers
The MCP server SHALL have unit tests for all tool handler functions. Tests MUST mock ApiClient so no real HTTP is made. Each handler test SHALL verify: correct ApiClient method is called, response is correctly mapped to MCP tool result format, and error cases are handled.

#### Scenario: Tool handler calls correct ApiClient method
- **WHEN** an MCP tool handler is invoked with valid arguments
- **THEN** the corresponding ApiClient method is called with the expected parameters

#### Scenario: Tool handler maps ApiClient response to MCP result format
- **WHEN** ApiClient returns a successful response
- **THEN** handler returns an object conforming to the MCP tool result schema (content array with text or json entries)

#### Scenario: Tool handler returns error result on ApiClient failure
- **WHEN** ApiClient throws an error
- **THEN** handler returns an MCP error result (isError: true) with a descriptive message instead of throwing

### Requirement: Unit tests cover MCP ApiClient
The MCP ApiClient SHALL have unit tests verifying it constructs correct HTTP requests and parses responses. Tests MUST extend existing api-client test coverage to include all methods used by tool handlers.

#### Scenario: ApiClient sets Authorization header from stored credentials
- **WHEN** ApiClient makes a request and credentials are stored
- **THEN** the HTTP request includes `Authorization: Bearer <token>` header

#### Scenario: ApiClient throws descriptive error on non-2xx response
- **WHEN** the server returns 4xx or 5xx
- **THEN** ApiClient throws an error with status code and response body included in the message

#### Scenario: Existing api-client tests remain passing
- **WHEN** `npm test` is run in the MCP application
- **THEN** both existing and new test files pass without modification to existing specs
