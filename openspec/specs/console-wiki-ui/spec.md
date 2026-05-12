## MODIFIED Requirements

### Requirement: ProjectDetail shows wiki pages instead of raw synthesis files

The project detail page SHALL replace collapsible `<details>/<pre>` blocks with a category-grouped wiki pages table. Each page row shows title, category, and last updated time. Page titles are clickable and navigate to a page viewer that renders markdown.

#### Scenario: Project with 12 wiki pages
- **GIVEN** project synthesis completed with 12 pages across 4 categories
- **WHEN** user views project detail
- **THEN** pages are grouped by category (entities, logic, contracts, config) with titles and timestamps
- **AND** clicking a page title opens the rendered markdown view

#### Scenario: No synthesis yet
- **GIVEN** project has no wiki pages
- **WHEN** user views project detail
- **THEN** wiki section shows empty state message indicating synthesis hasn't run

### Requirement: Wiki page viewer renders markdown

A page viewer route or component SHALL fetch a wiki page by slug and render its markdown content with proper formatting (headings, tables, code blocks, links). Related Pages links at the bottom of each page SHALL be clickable and navigate to other wiki pages.

#### Scenario: View entity page
- **WHEN** user clicks "User" in entities category
- **THEN** page viewer fetches `GET /synthesis/file?path=entities/user`
- **AND** renders markdown with headings, code blocks, tables
- **AND** Related Pages links navigate to other wiki pages within the viewer

## ADDED Requirements

### Requirement: Interactive search for project knowledge

The project detail page SHALL include a search box where users can type natural language questions about the project. Submitting a question calls `POST /orgs/:org/projects/:project/search` and displays the answer as rendered markdown.

#### Scenario: Product manager asks about API
- **GIVEN** project has wiki with API documentation
- **WHEN** user types "what endpoints are available for user management?" and submits
- **THEN** answer is displayed as rendered markdown with endpoint details
- **AND** source page slugs are shown as clickable links

#### Scenario: Search while waiting for response
- **WHEN** user submits a question
- **THEN** loading indicator is shown (search can take 3-5 seconds due to LLM calls)
- **AND** input is disabled until response arrives

#### Scenario: No API key configured
- **WHEN** user tries to search but no Anthropic API key is configured
- **THEN** error message indicates API key is required with link to project settings
