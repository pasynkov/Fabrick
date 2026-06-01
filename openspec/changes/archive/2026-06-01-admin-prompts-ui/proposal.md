## Why

The previous change `prompts-registry` shipped the backend for prompt revisions and an `admin-prompts` spec that scoped both the HTTP API and the admin console UI. The implementation delivered the HTTP endpoints under `/v1/admin/prompts` and the database storage, but the admin console UI was skipped during apply ("no admin console directory found"). The admin app actually exists at `applications/admin/` with an established list-detail pattern (Users/Orgs/Projects/Searches). Without the UI, operators cannot use the registry — every prompt edit still requires hand-crafting a POST request. This change closes the gap by building the Prompts section in the admin console against the already-deployed backend.

## What Changes

- **NEW** `Prompts` nav tab added to `applications/admin/src/TabBar.tsx`, pointing at `/prompts`.
- **NEW** Route `/prompts` mounted in `applications/admin/src/App.tsx`, rendering a list view that calls `GET /v1/admin/prompts` and displays one row per `(name, agent)` with columns: name, agent, current revision, updated at, last editor (`createdBy`). Rows link to the detail view.
- **NEW** Route `/prompts/:name/:agent` mounted in `App.tsx`, rendering a detail view with two tabs: "Edit" and "History".
- **NEW** Edit tab fetches `GET /v1/admin/prompts/:name/:agent`, renders the `content.files` object in a textarea pre-populated with pretty-printed JSON, plus a `note` text input. A `Save` button POSTs `{ files, note }` to `/v1/admin/prompts/:name/:agent`. On `201` the view refetches the latest and surfaces the new revision number to the user.
- **NEW** Save button is disabled while the textarea content does not parse as a JSON object whose values are all strings, with an inline parse-error message displayed to the user.
- **NEW** History tab fetches `GET /v1/admin/prompts/:name/:agent/history`, lists every revision newest first with `revision`, `createdAt`, `createdBy`, `note`. Clicking a row fetches `GET /v1/admin/prompts/:name/:agent/:revision` and renders the `content.files` object in a read-only JSON viewer next to the row list.
- **NEW** Typed API client methods added to `applications/admin/src/api.ts` under `api.admin.prompts` mirroring the existing `api.admin.<resource>` style.
- **NEW** Page components `PromptsList.tsx` and `PromptDetail.tsx` added under `applications/admin/src/pages/`, following the same Tailwind/list/detail conventions used by the other admin pages.

## Capabilities

### New Capabilities
- `admin-prompts-ui`: The admin console Prompts section — nav entry, list view, detail view with Edit and History tabs, JSON validation, and typed API client.

### Modified Capabilities
- (none — the underlying spec `admin-prompts` already covers the requirement; it was archived as part of `prompts-registry` and the requirement "Admin console exposes a Prompts section" remains the canonical contract that this change implements.)

## Impact

- **Code (frontend)** — new `applications/admin/src/pages/PromptsList.tsx`, new `applications/admin/src/pages/PromptDetail.tsx`, edits to `applications/admin/src/TabBar.tsx`, `applications/admin/src/App.tsx`, and `applications/admin/src/api.ts`.
- **Code (backend)** — none. Endpoints already exist on `/v1/admin/prompts`.
- **Tests** — component-level tests for `PromptsList` and `PromptDetail` (mocked API), JSON validation guard, and history-tab navigation. No backend tests change.
- **Auth** — relies on the existing `AdminGuard` at the app level for the nav item visibility and on the backend `PlatformAdminGuard` for hard enforcement. No new guards added.
- **Dependencies** — none added; the admin app already uses React Router and Tailwind. The textarea-based JSON editor is plain `<textarea>` with client-side `JSON.parse`, no editor library introduced.
- **Behavior** — non-PlatformAdmin users see a 401/403 from the backend if they construct the URL directly; the nav item visibility is enforced by `AdminGuard`. No data is mutated until the user clicks Save, which always creates a new revision (immutable history preserved).
