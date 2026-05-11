## MODIFIED Requirements

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
