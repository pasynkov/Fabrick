## 1. API client extension

- [ ] 1.1 Add typed interfaces `AdminPromptListItem`, `AdminPromptRevision` (`{ id, name, agent, revision, content: { files: Record<string, string> }, note, createdBy, createdAt }`), `AdminPromptHistoryItem`, and `CreatePromptRevisionBody` to `applications/admin/src/api.ts`.
- [ ] 1.2 Add an `api.admin.prompts` namespace with `list()`, `latest(name, agent)`, `history(name, agent)`, `revision(name, agent, revision)`, and `create(name, agent, body)` going through the existing `request<T>` helper.

## 2. TabBar nav

- [ ] 2.1 Add a `{ label: 'Prompts', to: '/prompts' }` entry to the `tabs` array in `applications/admin/src/TabBar.tsx`, placed after `Searches`.

## 3. Routing

- [ ] 3.1 Register routes `<Route path="/prompts" element={<PromptsList />} />` and `<Route path="/prompts/:name/:agent" element={<PromptDetail />} />` in `applications/admin/src/App.tsx` and add the corresponding imports.

## 4. PromptsList page

- [ ] 4.1 Create `applications/admin/src/pages/PromptsList.tsx` modelled on `UsersList.tsx` / `SearchesList.tsx`: hook for fetching `api.admin.prompts.list()`, table with columns `name`, `agent`, `revision`, `updatedAt` (formatted), `createdBy`, rows linking to `/prompts/:name/:agent`.
- [ ] 4.2 Render a loading state while the fetch is in flight, an empty-state message when the response is `[]`, and the error message on failure (same UX as the other list pages).
- [ ] 4.3 Add a component test (Vitest + React Testing Library if used elsewhere in this app; otherwise plain assertions matching the existing test conventions) covering happy-path render, loading state, empty state, and error state.

## 5. PromptDetail page

- [ ] 5.1 Create `applications/admin/src/pages/PromptDetail.tsx` with two tabs `Edit` and `History`, defaulting to `Edit`. Read `:name` and `:agent` from `useParams`.
- [ ] 5.2 On mount fetch `api.admin.prompts.latest(name, agent)`. Pre-populate a `<textarea>` with `JSON.stringify(row.content.files, null, 2)` and a separate `<input>` for `note`.
- [ ] 5.3 Compute on every textarea change: `JSON.parse(text)` is valid, result is a non-null plain object, has ≥ 1 key, every value is a string. Disable Save unless all four hold; render an inline error message describing the failing condition.
- [ ] 5.4 Implement the Save handler: POST via `api.admin.prompts.create`; on `201` refetch the latest row and surface a success message containing the new revision number; on rejection surface the error message and leave the form unchanged.
- [ ] 5.5 Implement the History tab: on tab activation fetch `api.admin.prompts.history(name, agent)`; render the rows newest-first with `revision`, `createdAt`, `createdBy`, `note`. Clicking a row fetches `api.admin.prompts.revision(name, agent, n)` and renders the returned `content.files` in a read-only `<pre>` showing `JSON.stringify(..., null, 2)` alongside the list.
- [ ] 5.6 Ensure the History tab has no editing controls (no Save button, the JSON viewer is read-only).
- [ ] 5.7 Add a component test covering: Edit-tab JSON-validation guard (disabled Save for parse error, empty object, non-string value; enabled for valid object), save flow happy path (POST called with correct body, refetch on success, success message naming the new revision), History tab loads list and renders selected revision in the viewer.

## 6. Verification

- [ ] 6.1 `npm run build` for `applications/admin/` succeeds.
- [ ] 6.2 `npm test` (or the existing admin test command) for `applications/admin/` succeeds.
- [ ] 6.3 Manually exercise against a running api: list shows the four seeded prompts, drill in, save a new revision, verify the success message names the bumped revision, open History, click an older revision and verify the JSON viewer renders that older content.
