## ADDED Requirements

### Requirement: Search endpoint performs LLM-powered search over project wiki

API SHALL expose `POST /orgs/:org/projects/:project/search` accepting `{ question: string }` and returning `{ answer: string, sources: string[] }`. Protected by FabrickAuthGuard (MCP token or user token).

#### Scenario: Agent asks about an endpoint
- **WHEN** agent calls search with question "what endpoint returns user profile data?"
- **AND** project wiki has pages describing REST endpoints
- **THEN** response contains answer with endpoint path, method, and schema details
- **AND** sources lists the page slugs used to formulate the answer

#### Scenario: Question with no relevant pages
- **WHEN** question is about something not covered by wiki
- **THEN** answer states the information is not available in the wiki

### Requirement: Search uses two-step LLM flow

Search SHALL perform two LLM calls:
1. Send index page + question → LLM returns list of relevant page slugs
2. Send selected pages + question → LLM formulates answer

This avoids sending all pages for every query.

#### Scenario: Index scan selects 2 out of 20 pages
- **GIVEN** project wiki has 20 pages
- **WHEN** question is about user authentication
- **THEN** LLM call #1 selects ~2-3 relevant pages (e.g. entities/user, logic/auth-flow)
- **AND** only those pages are loaded for LLM call #2

### Requirement: Search uses user's Anthropic API key

Search SHALL resolve the Anthropic API key from project settings (project → org fallback). Same resolution logic as synthesis trigger. If no key configured, return 400 with message indicating API key is required.

#### Scenario: Project has API key
- **WHEN** search is called for project with configured key
- **THEN** LLM calls use that key

#### Scenario: No API key configured
- **WHEN** search is called for project without any API key (project or org level)
- **THEN** 400 response with error message
