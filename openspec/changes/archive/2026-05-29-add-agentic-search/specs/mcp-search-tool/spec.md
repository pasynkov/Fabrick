## MODIFIED Requirements

### Requirement: MCP exposes single fabrick_search tool with dynamic description

MCP server SHALL expose `fabrick_search` accepting `{ question: string }`. The tool calls `POST /orgs/:org/projects/:project/search` with the question and returns the answer text. The underlying server-side search performs an agentic loop and may take longer than the previous 2-step flow; the MCP tool contract is unchanged and SHALL surface the resulting answer text as-is.

At startup, MCP SHALL fetch the `mcp-description` page from the API and use its content as the tool description. If the page is not available (no synthesis run yet), MCP SHALL use a generic fallback description.

At startup, MCP SHALL fetch the `mcp-instructions` page from the API and use its content as the server instructions. If the page is not available, MCP SHALL use a fallback instructions string that includes guidance to **call `fabrick_search` at most once per user question** and to report "not found in wiki" rather than retrying with rephrased queries.

#### Scenario: Dynamic tool description loaded
- **GIVEN** project wiki has an `mcp-description` page with content describing available repos, endpoints, entities, flows
- **WHEN** MCP server starts
- **THEN** `fabrick_search` tool description contains the project-specific summary
- **AND** agent sees what knowledge is available before calling the tool

#### Scenario: No synthesis yet — fallback description
- **GIVEN** project has no wiki pages (synthesis never ran)
- **WHEN** MCP server starts
- **THEN** `fabrick_search` tool description is a generic "Search the project knowledge base..."

#### Scenario: Agent uses fabrick_search
- **WHEN** agent calls `fabrick_search({ question: "how does the checkout flow work?" })`
- **THEN** MCP calls the search API endpoint
- **AND** returns the answer text as tool result

#### Scenario: Search API returns error
- **WHEN** search API returns non-200 status
- **THEN** MCP tool returns error message to the agent

#### Scenario: Search API takes longer than the previous flow
- **WHEN** the underlying agentic loop runs multiple iterations before responding
- **THEN** MCP waits for the API response and returns the answer text unchanged
- **AND** the tool contract `{ question }` → answer text is not altered

#### Scenario: Fallback server instructions discourage parallel calls
- **GIVEN** project has no `mcp-instructions` wiki page
- **WHEN** MCP server starts
- **THEN** server instructions include guidance to call `fabrick_search` at most once per question
- **AND** instructions state that if the wiki has no answer, the agent should report this rather than retry
