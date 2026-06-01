## ADDED Requirements

### Requirement: Admin console exposes a Prompts tab in the nav
The admin console SHALL render a `Prompts` entry in its TabBar pointing at the route `/prompts`. The TabBar entry SHALL use the same Tailwind classes and active-state styling as the existing entries (`Users`, `Orgs`, `Projects`, `Searches`). Visibility of the tab SHALL be governed by the existing `AdminGuard` (the entire admin app already requires authentication); no per-tab guard is added.

#### Scenario: Tab appears for an authenticated admin
- **WHEN** an authenticated user loads the admin app
- **THEN** the TabBar contains a `Prompts` entry whose target is `/prompts`
- **AND** clicking it activates the entry with the same active-state styling used by the other tabs

#### Scenario: Unauthenticated user sees no tabs
- **WHEN** an unauthenticated user loads the admin app
- **THEN** the existing `AdminGuard` redirects to `/login` and no tabs are rendered

### Requirement: Prompts list view shows one row per (name, agent) latest revision
The route `/prompts` SHALL render a list view that, on mount, calls `GET /v1/admin/prompts` and displays the returned array in a table with columns: `name`, `agent`, `revision`, `updatedAt` (formatted as a human-readable timestamp), `createdBy` (raw user id). Each row SHALL be a navigation link to `/prompts/:name/:agent` for that pair. While the fetch is in flight the view SHALL display a loading state; on fetch error it SHALL display the error message returned by the existing `api` client.

#### Scenario: List renders after a successful fetch
- **WHEN** the user navigates to `/prompts`
- **AND** `GET /v1/admin/prompts` returns three entries
- **THEN** the table renders three rows, one per `(name, agent)` pair
- **AND** each row links to `/prompts/<name>/<agent>`

#### Scenario: Empty list
- **WHEN** the list endpoint returns an empty array
- **THEN** the view renders an empty-state message instead of a table

#### Scenario: Loading state
- **WHEN** the user navigates to `/prompts`
- **AND** the fetch has not yet resolved
- **THEN** the view shows a loading indicator and no table

#### Scenario: Fetch error
- **WHEN** `GET /v1/admin/prompts` rejects with an error
- **THEN** the view shows the error message from the rejected promise
- **AND** does not render a table

### Requirement: Prompt detail view has an Edit tab with a JSON editor for content.files
The route `/prompts/:name/:agent` SHALL render a detail view that defaults to an `Edit` tab. The tab SHALL fetch `GET /v1/admin/prompts/:name/:agent` on mount and pre-populate a `<textarea>` with `JSON.stringify(row.content.files, null, 2)`. A separate `note` text input SHALL be rendered alongside the textarea. A `Save` button SHALL POST `{ files, note }` to `/v1/admin/prompts/:name/:agent` where `files` is the parsed textarea content and `note` is the (possibly empty) input value. On `201` the view SHALL refetch the latest revision and display a success message naming the new revision number.

#### Scenario: Edit tab loads pretty-printed JSON
- **WHEN** the user navigates to `/prompts/search/claude`
- **AND** `GET /v1/admin/prompts/search/claude` returns a row with `content.files = { "prompt.md": "..." }`
- **THEN** the textarea contains `{\n  "prompt.md": "..."\n}` (2-space pretty-printed JSON)

#### Scenario: Successful save creates a new revision
- **WHEN** the user edits the textarea and clicks `Save`
- **AND** the backend returns `201 { id, revision: 3 }`
- **THEN** the view refetches `GET /v1/admin/prompts/:name/:agent`
- **AND** displays a success message containing the text `revision 3`
- **AND** the textarea reflects the freshly-fetched latest content

#### Scenario: Save failure surfaces the backend error
- **WHEN** the POST rejects with a `400` carrying a backend message
- **THEN** the view displays that message
- **AND** does not refetch the detail row

### Requirement: Save is blocked while the textarea content is not a valid JSON object of strings
The Edit tab SHALL parse the current textarea content on every change. The Save button SHALL be disabled and an inline error message SHALL be displayed whenever any of the following holds:

- `JSON.parse(textarea)` throws,
- the parse result is `null` or not a plain object,
- any value in the parsed object is not a string,
- the parsed object has zero keys.

When all four conditions are met, the Save button SHALL be enabled and no error message SHALL be displayed.

#### Scenario: Invalid JSON disables Save
- **WHEN** the textarea contains a trailing comma or other invalid JSON
- **THEN** the Save button is disabled
- **AND** an inline error message indicates a parse error

#### Scenario: Empty object disables Save
- **WHEN** the textarea contains `{}`
- **THEN** the Save button is disabled
- **AND** an inline message indicates that at least one file is required

#### Scenario: Non-string value disables Save
- **WHEN** the textarea contains `{ "SKILL.md": 42 }`
- **THEN** the Save button is disabled
- **AND** an inline message indicates that all values must be strings

#### Scenario: Valid object enables Save
- **WHEN** the textarea contains `{ "prompt.md": "hello" }`
- **THEN** the Save button is enabled
- **AND** no error message is displayed

### Requirement: Prompt detail view has a History tab that lists revisions and renders a selected one read-only
The detail view SHALL render a second tab labelled `History`. Selecting the tab SHALL call `GET /v1/admin/prompts/:name/:agent/history` and render the returned revisions newest-first in a list, each row showing `revision`, `createdAt`, `createdBy`, and `note`. Clicking a row SHALL call `GET /v1/admin/prompts/:name/:agent/:revision` and render the returned `content.files` object in a read-only pretty-printed JSON viewer next to the list. The History tab SHALL NOT expose any editing controls.

#### Scenario: History tab lists revisions newest first
- **WHEN** the user clicks the History tab
- **AND** the history endpoint returns revisions `3, 2, 1` newest first
- **THEN** the list renders three rows in that order
- **AND** none of the rows displays `content`

#### Scenario: Selecting a revision loads its content read-only
- **WHEN** the user clicks the row for revision `2`
- **AND** `GET /v1/admin/prompts/:name/:agent/2` returns the row with its `content.files`
- **THEN** the viewer next to the list renders `JSON.stringify(content.files, null, 2)`
- **AND** there is no Save button in the History tab

#### Scenario: Roll-forward path is unsurfaced but possible
- **WHEN** the user reads an older revision in the History tab
- **AND** copies its `content.files` JSON, switches to the Edit tab, pastes it into the textarea, and clicks Save
- **THEN** a new revision is created from that content
- **AND** the History tab now includes that new revision at the top

### Requirement: Typed prompts API client lives in api.ts under api.admin.prompts
The file `applications/admin/src/api.ts` SHALL expose typed methods under `api.admin.prompts` for the five endpoints used by the UI: `list()`, `latest(name, agent)`, `history(name, agent)`, `revision(name, agent, revision)`, and `create(name, agent, body)`. Each method SHALL go through the existing `request<T>` helper so it inherits auth, token-refresh, and error-handling behaviour. New TypeScript types (`AdminPromptListItem`, `AdminPromptRevision`, `AdminPromptHistoryItem`, `CreatePromptRevisionBody`) SHALL be exported from the same file alongside the existing admin types.

#### Scenario: Methods route through the shared request helper
- **WHEN** any of the new `api.admin.prompts` methods is invoked
- **THEN** the underlying HTTP call uses the existing `request<T>` helper
- **AND** the call carries the same Bearer auth header and refresh-token behaviour as the other admin endpoints

#### Scenario: create returns the new revision id and number
- **WHEN** `api.admin.prompts.create('search', 'claude', { files: { 'prompt.md': '...' }, note: 'tweak' })` resolves
- **AND** the backend returns `201 { id, revision }`
- **THEN** the promise resolves with `{ id, revision }` typed accordingly
