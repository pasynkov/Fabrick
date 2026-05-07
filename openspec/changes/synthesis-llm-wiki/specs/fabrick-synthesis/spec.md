## MODIFIED Requirements

### Requirement: Synthesis worker outputs concept-organized pages to DB
The synthesis worker SHALL output synthesis results as a structured array of pages — organized by concept taxonomy (index, entities/*, services/*, flows/*, contracts/*) — and upsert them to the API via `PUT /internal/synthesis/pages`. It SHALL NOT write synthesis output to blob storage.

#### Scenario: Synthesis produces concept-organized pages
- **WHEN** synthesis processes a project with repos `api` and `worker`
- **THEN** worker sends pages with slugs such as `index`, `entities/User`, `services/api`, `flows/checkout`, `contracts/events`

#### Scenario: Root index page always produced
- **WHEN** synthesis runs for any project
- **THEN** a page with `slug: "index"` and `category: "index"` is always included in the upsert batch

#### Scenario: Pages upserted via internal endpoint
- **WHEN** synthesis completes successfully
- **THEN** worker calls `PUT /internal/synthesis/pages` with all pages and the callbackToken from the queue message

### Requirement: LLM prompt instructs structured JSON output
The synthesis LLM prompt SHALL instruct the model to output a JSON array of page objects `[{ slug, category, title, content, sources }]` rather than free-form markdown files. The worker SHALL parse this JSON and submit it to the upsert endpoint.

#### Scenario: LLM output is valid JSON array
- **WHEN** synthesis LLM receives a well-formed prompt with repo contexts
- **THEN** response is a JSON array of page objects parseable without error

#### Scenario: LLM parse failure reported via status callback
- **WHEN** LLM response cannot be parsed as JSON
- **THEN** worker calls `POST /internal/synthesis/status` with `{ status: "error", error: "LLM output parse failed" }`

## REMOVED Requirements

### Requirement: Synthesis writes output to blob storage
**Reason**: Replaced by database storage. Synthesis output is now upserted into `synthesis_pages` table via internal API endpoint. Blob storage is retained for raw context files only.
**Migration**: No action needed. Existing blob synthesis files remain in storage but are no longer read by the API. New synthesis runs write only to DB.
