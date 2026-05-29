## MODIFIED Requirements

### Requirement: SearchImpl performs agentic tool-use loop using WikiRepository
`SearchImpl.search()` SHALL implement an agentic search loop using the Anthropic SDK's tool-use protocol. It SHALL load the project's `index` page via WikiRepository, build an initial message stack consisting of (a) a system prompt describing the agent role and listing tool descriptions, (b) a user message containing the index page content, and (c) a user message containing the question. It SHALL call `messages.create` with a defined `tools` array and iterate until the model returns `stop_reason: "end_turn"` or a budget cap is reached. It SHALL return `{ answer, sources }` where `answer` is the model's final markdown (with any trailing `SOURCES:` line stripped) and `sources` is the slug list the model emits on that line. The 2-step Claude flow (single slug-selection call followed by a single answer call) SHALL be removed.

#### Scenario: Successful agentic search with single page
- **WHEN** `search` is called with `projectId`, `question`, and `apiKey`
- **AND** the model decides one `read_page` call is enough
- **THEN** the loop executes the tool, appends the result, the model returns `stop_reason: "end_turn"` with a final answer ending in `SOURCES: <slug>`
- **AND** the function returns `{ answer, sources: ["<slug>"] }` with the `SOURCES:` line removed from `answer`

#### Scenario: Successful agentic search with multi-hop traversal
- **WHEN** the model calls `read_page` then `read_related` then `read_page` and finally emits `end_turn`
- **THEN** all tool calls are executed against `WikiRepository`
- **AND** the returned `sources` matches the slug list on the model's `SOURCES:` line

#### Scenario: No index page
- **WHEN** `search` is called but `WikiRepository` has no page with slug `index`
- **THEN** `SearchImpl` throws an error indicating no wiki pages found
- **AND** no Anthropic call is made

#### Scenario: Model emits final answer without SOURCES line
- **WHEN** the model returns `stop_reason: "end_turn"` with no trailing `SOURCES:` line
- **THEN** `SearchImpl` returns `answer` unchanged
- **AND** `sources` is the set of slugs read via `read_page`, `read_pages`, and `read_related` during the loop
- **AND** a warning is logged

### Requirement: SearchImpl exposes a defined tool set to the model
`SearchImpl` SHALL register the following tools with `messages.create` and SHALL execute them against the injected `WikiRepository`:
- `list_categories()` → `{ categories: string[] }`
- `list_in(category)` → `{ pages: Array<{ slug, title, one_liner }> }`
- `page_meta(slug)` → `{ title, category, related: string[], sources: string[], size: number }`
- `read_page(slug)` → `{ slug, content }`
- `read_pages(slugs[])` → `{ pages: Array<{ slug, content }> }` (max 6 slugs per call)
- `read_related(slug, depth)` → `{ pages: Array<{ slug, content }> }` (depth ∈ {1, 2}, default 1)

#### Scenario: Each tool maps to a WikiRepository call
- **WHEN** the model calls `list_categories`
- **THEN** `SearchImpl` invokes `WikiRepository.findCategories(projectId)`
- **WHEN** the model calls `list_in(category)`
- **THEN** `SearchImpl` invokes `WikiRepository.findByCategory(projectId, category)` and projects to `{ slug, title, one_liner }`
- **WHEN** the model calls `read_page(slug)`
- **THEN** `SearchImpl` invokes `WikiRepository.findBySlug(projectId, slug)` and returns the content
- **WHEN** the model calls `read_pages(slugs)` with more than 6 slugs
- **THEN** the tool result returns an error and the loop continues

#### Scenario: Unknown slug
- **WHEN** the model calls `read_page` with a slug not in `WikiRepository`
- **THEN** the tool result is `{ ok: false, error: "page not found: <slug>" }` and the loop continues

#### Scenario: read_related traverses WikiPage.related[]
- **WHEN** the model calls `read_related(slug, depth=1)`
- **THEN** `SearchImpl` reads the page's `related[]` slugs and returns their content via `findBySlugs`

### Requirement: SearchImpl enables Anthropic prompt caching on stable prefix
`SearchImpl` SHALL set `cache_control: { type: 'ephemeral' }` on the system block and on the user message containing the index page. The user message containing the question and the per-iteration `tool_use`/`tool_result` tail SHALL NOT carry cache breakpoints.

#### Scenario: Cache breakpoints on prefix
- **WHEN** `SearchImpl` builds a request to `messages.create`
- **THEN** the system block carries `cache_control: { type: 'ephemeral' }`
- **AND** the index user message carries `cache_control: { type: 'ephemeral' }`
- **AND** subsequent messages carry no cache breakpoints

### Requirement: SearchImpl enforces loop and content budgets
`SearchImpl` SHALL enforce three budget caps: `maxIters` (default 8), `maxPagesRead` (default 12, counted across `read_page`, `read_pages`, and `read_related`), and `maxTotalTokens` (default 50000, summed from `usage.input_tokens + usage.output_tokens` per response). When any cap is reached before the model emits `end_turn`, `SearchImpl` SHALL append a user message instructing the model to give a partial answer with the slugs it has and end with the `SOURCES:` line, then make one final call.

#### Scenario: max_iters reached
- **WHEN** the loop has executed `maxIters` model turns without `end_turn`
- **THEN** `SearchImpl` appends the partial-finalize user message and calls `messages.create` once more
- **AND** the returned answer is parsed as in the normal path

#### Scenario: max_pages_read reached
- **WHEN** the cumulative count of pages returned by content tools reaches `maxPagesRead`
- **THEN** the next content-tool call returns an error in its `tool_result`
- **AND** the loop continues until the model emits `end_turn` or another cap fires

#### Scenario: max_total_tokens reached
- **WHEN** the running sum of input+output tokens reaches `maxTotalTokens`
- **THEN** the loop appends the partial-finalize user message and makes one final call

#### Scenario: stop_reason max_tokens
- **WHEN** the model returns `stop_reason: "max_tokens"`
- **THEN** `SearchImpl` appends the partial-finalize user message and makes one final call

### Requirement: SearchImpl injects WikiRepository via DI
`SearchImpl` SHALL receive `WikiRepository` through `@Inject(WIKI_REPOSITORY)` constructor injection. It SHALL NOT import or depend on any specific implementation (TypeORM, FS, HTTP).

#### Scenario: SearchImpl works with any WikiRepository implementation
- **WHEN** `SearchImpl` is instantiated with `FsWikiRepository`
- **THEN** it performs the agentic loop using filesystem-backed pages
- **WHEN** `SearchImpl` is instantiated with `TypeOrmWikiRepository`
- **THEN** it performs the agentic loop using Postgres-backed pages

### Requirement: Search prompts are inline in SearchImpl
The system prompt — including agent role description, tool guidance, and worked examples — SHALL be defined inline within `SearchImpl`. No external prompt files.

#### Scenario: Prompts are self-contained
- **WHEN** `SearchImpl` is used
- **THEN** it requires no external prompt files or assets — all prompts are in the source code

## REMOVED Requirements

### Requirement: Claude returns slugs with .md suffix
**Reason**: The 2-step slug-selection prompt is removed; the new flow uses tool-call arguments for slugs, so `.md` suffix normalization on a JSON slug array is no longer applicable.
**Migration**: None at the API boundary. If a model ever passes a slug with `.md` suffix to `read_page`, the tool result returns `page not found` and the model can correct itself; no normalization is required.
