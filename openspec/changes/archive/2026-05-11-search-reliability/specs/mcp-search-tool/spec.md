## MODIFIED Requirements

### Requirement: MCP exposes single fabrick_search tool with dynamic description

MCP server SHALL remove `get_synthesis_index` and `get_synthesis_file` tools. SHALL add `fabrick_search` tool accepting `{ question: string }`. Tool calls `POST /orgs/:org/projects/:project/search` with the question and returns the answer text.

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
- **THEN** MCP calls search API endpoint
- **AND** returns answer text as tool result

#### Scenario: Search API returns error
- **WHEN** search API returns non-200 status
- **THEN** MCP tool returns error message to the agent

#### Scenario: Fallback server instructions discourage parallel calls
- **GIVEN** project has no `mcp-instructions` wiki page
- **WHEN** MCP server starts
- **THEN** server instructions include guidance to call `fabrick_search` at most once per question
- **AND** instructions state that if the wiki has no answer, the agent should report this rather than retry

### Requirement: MCP uses existing token for auth

MCP SHALL use the existing `FABRICK_TOKEN` (MCP-scoped JWT with org/project claims) to authenticate against the search endpoint. No new token type needed.

#### Scenario: Token passed to search API
- **WHEN** `fabrick_search` is called
- **THEN** request to search API includes `Authorization: Bearer <token>` header with the MCP token

## ADDED Requirements

### Requirement: Synthesis generates mcp-description page

The synthesis prompt SHALL instruct the LLM to generate a page with slug `mcp-description` containing a ~200 word summary of available project knowledge. The summary SHALL:
- List all repos/apps with 1-line purpose each
- Summarize knowledge categories (entities, endpoints, flows, transport, config)
- Mention notable specifics (e.g. "15 REST endpoints", "3 NATS topics")
- Be written in 2nd person as a tool description ("you can find...", "ask about...")
- Include a `## When to use` section listing concrete cross-layer trigger examples based on the layers/apps present in the project (e.g., "working in frontend and need backend API contracts"). SHALL NOT say "always use this tool".

#### Scenario: mcp-description generated during synthesis
- **GIVEN** project has 3 repos with wikis covering entities, endpoints, and flows
- **WHEN** synthesis runs
- **THEN** output includes an `mcp-description` page
- **AND** page content lists all 3 repos, summarizes available knowledge categories, and mentions specific counts
- **AND** page includes a "When to use" section with cross-layer examples matching the actual repos present

#### Scenario: When-to-use section is context-sensitive
- **GIVEN** project has frontend and backend repos
- **WHEN** synthesis runs
- **THEN** "When to use" section in mcp-description includes examples like "working in frontend and need backend API contracts"
- **AND** does not include examples for layers not present in the project

#### Scenario: mcp-description updated on re-synthesis
- **GIVEN** a new repo was added to the project
- **WHEN** synthesis runs again
- **THEN** `mcp-description` page is updated to include the new repo
- **AND** "When to use" section is updated to reflect new cross-layer possibilities

### Requirement: Synthesis generates mcp-instructions page

The synthesis prompt SHALL instruct the LLM to generate a page with slug `mcp-instructions` containing behavioral guidance for the MCP client. The page SHALL include:
- Instruction to call `fabrick_search` at most once per user question
- Instruction to report "not found in wiki, check source code" rather than retrying with rephrased queries
- Context about what the wiki covers and what it does not (source-code-level details not captured)

#### Scenario: mcp-instructions generated during synthesis
- **WHEN** synthesis runs for a project
- **THEN** output includes an `mcp-instructions` page
- **AND** page content includes single-call-per-question guidance

#### Scenario: mcp-instructions used as server instructions
- **GIVEN** project wiki has an `mcp-instructions` page
- **WHEN** MCP server starts
- **THEN** server instructions field is set to the content of the `mcp-instructions` page
