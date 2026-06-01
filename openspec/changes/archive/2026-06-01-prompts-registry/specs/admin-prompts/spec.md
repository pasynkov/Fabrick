## ADDED Requirements

### Requirement: Admin HTTP API exposes prompt registry under /v1/admin/prompts
The api SHALL expose a `PromptsController` mounted at path `prompts` under the `/v1/admin` prefix, guarded such that only authenticated users with the PlatformAdmin role can access any of its routes. The controller SHALL implement the following endpoints, all returning `application/json`:

- `GET /v1/admin/prompts` — returns a list of distinct `(name, agent)` pairs with their current `revision`, `updatedAt`, and `note`.
- `GET /v1/admin/prompts/:name/:agent` — returns the latest revision for that pair: `{ id, name, agent, revision, content, note, createdBy, createdAt }`.
- `GET /v1/admin/prompts/:name/:agent/history` — returns an array of every revision for that pair, newest first, with `{ id, revision, note, createdBy, createdAt }` but without `content`.
- `GET /v1/admin/prompts/:name/:agent/:revision` — returns the full row for that specific revision number, including `content`.
- `POST /v1/admin/prompts/:name/:agent` — accepts a body `{ files: Record<string, string>, note?: string }`, validates that `files` is a non-empty object whose values are strings, inserts a new row with `revision = MAX(revision) + 1` for that pair, sets `createdBy` to the caller's user id, and returns `201 Created` with `{ id, revision }`.

#### Scenario: Non-admin caller is rejected
- **WHEN** a user without the PlatformAdmin role calls any of these endpoints
- **THEN** the response is `403 Forbidden`

#### Scenario: Unauthenticated caller is rejected
- **WHEN** a request arrives with no auth credentials
- **THEN** the response is `401 Unauthorized`

#### Scenario: List endpoint returns one row per (name, agent)
- **WHEN** the table contains `(search, claude, 1)`, `(search, claude, 2)`, `(synthesis, claude, 1)`
- **AND** an admin calls `GET /v1/admin/prompts`
- **THEN** the response contains two entries
- **AND** the `search/claude` entry reports `revision: 2`
- **AND** the `synthesis/claude` entry reports `revision: 1`

#### Scenario: Latest endpoint includes content
- **WHEN** an admin calls `GET /v1/admin/prompts/search/claude`
- **THEN** the response body includes the full `content.files` object for the latest revision

#### Scenario: History endpoint omits content
- **WHEN** an admin calls `GET /v1/admin/prompts/search/claude/history`
- **THEN** the response is an array of revision summaries
- **AND** no `content` field appears in any summary

#### Scenario: Specific revision endpoint includes content
- **WHEN** an admin calls `GET /v1/admin/prompts/search/claude/1`
- **THEN** the response includes the `content.files` object for revision 1

#### Scenario: POST creates a new revision
- **WHEN** an admin POSTs `{ files: { "prompt.md": "new body" }, note: "tweak tone" }` to `/v1/admin/prompts/search/claude`
- **AND** the current latest revision is 2
- **THEN** a new row is inserted with `revision = 3`
- **AND** the response is `201 Created` with `{ id, revision: 3 }`
- **AND** subsequent `GET /v1/admin/prompts/search/claude` returns the new content

#### Scenario: POST with invalid body is rejected
- **WHEN** an admin POSTs a body where `files` is missing, empty, or has non-string values
- **THEN** the response is `400 Bad Request` and no row is inserted

#### Scenario: POST for a new (name, agent) pair starts at revision 1
- **WHEN** an admin POSTs `/v1/admin/prompts/custom-prompt/claude` with valid content
- **AND** no row exists for that pair yet
- **THEN** a row is inserted with `revision = 1`

### Requirement: Admin console exposes a Prompts section
The admin console SHALL include a "Prompts" navigation item visible only to PlatformAdmin users. The section SHALL contain:

- A **list view** showing one row per `(name, agent)` with columns: name, agent, current revision, last updated, last editor.
- A **detail view** for a selected pair with a JSON editor whose content is the full `content.files` object of the latest revision. The editor SHALL allow free-form editing of the JSON. A "Save" button SHALL POST the edited object to the admin API; on success the view SHALL refresh and show the new revision number.
- A **history tab** within the detail view listing every revision (newest first) with `revision`, `createdAt`, `createdBy`, `note`. Clicking a revision SHALL load that revision's `content.files` into a read-only JSON viewer.

#### Scenario: Non-admin user does not see Prompts nav
- **WHEN** a user without PlatformAdmin loads the admin console
- **THEN** the Prompts nav item is not rendered

#### Scenario: Edit and save creates a new revision
- **WHEN** an admin opens `search/claude`, edits the JSON, and clicks Save
- **THEN** the console POSTs to `/v1/admin/prompts/search/claude`
- **AND** on `201` the displayed current revision increments by 1

#### Scenario: Invalid JSON blocks save
- **WHEN** the JSON editor content does not parse as a JSON object
- **THEN** Save is disabled or surfaces a validation error before any request is sent

#### Scenario: History view is read-only
- **WHEN** an admin selects an older revision from the history tab
- **THEN** the revision's `content.files` is displayed in a read-only view
- **AND** there is no Save button in that view

#### Scenario: Roll forward by editing
- **WHEN** an admin views an older revision, copies its content back into the editor of the current revision, and saves
- **THEN** a new revision is created with that content
- **AND** the history retains the intermediate revisions
