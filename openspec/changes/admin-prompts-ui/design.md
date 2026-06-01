## Context

`applications/admin/` is a small React + Vite + Tailwind app served at `/admin`. It uses `react-router-dom`, an `AdminGuard` wrapper that drives users to `/login` when unauthenticated, and a `TabBar` with hard-coded entries: Users / Orgs / Projects / Searches. Each tab has a list page and (where relevant) a detail page in `applications/admin/src/pages/`. All HTTP traffic flows through `applications/admin/src/api.ts`, which carries auth headers and refresh-token logic — every new endpoint goes through that file.

The backend already exposes the full admin-prompts surface at `/v1/admin/prompts` (controller in `applications/backend/api/src/prompts/prompts.controller.ts`). The endpoints return `PromptRevision` rows with `content.files: Record<string, string>` and standard metadata. There is nothing to design on the backend side.

The remaining work is purely frontend integration with one editor pattern decision to lock in: how to expose the multi-file `content.files` JSON to an operator.

## Goals / Non-Goals

**Goals:**
- Make the entire admin-prompts capability usable from the browser, end-to-end: list → drill into a prompt → see history → view an older revision → save a new revision.
- Match the existing admin app's visual and code conventions exactly. A reviewer should not be able to tell that Prompts was added later.
- Keep the JSON editing surface simple and dependency-free, while preventing the most common foot-gun (submitting invalid JSON or a non-string value).
- Keep network traffic minimal: one list fetch on entry, one detail fetch per drill-in, one history fetch when the History tab is opened, one revision fetch per revision click, one POST per save.

**Non-Goals:**
- Multi-tab per-file editing of `content.files`. The whole object is one JSON blob in one textarea. A future change can add per-file tabs if operators ask.
- Diff view between revisions. Operators read both revisions and compare visually for now.
- A dedicated rollback button. Roll-forward is "open the old revision, copy its JSON into the editor on Edit tab, Save."
- A separate code path for `name`s outside the seeded four. The UI is generic over `(name, agent)`.
- An "are you sure?" modal before Save. The action is non-destructive (history is immutable) and immediately reversible by saving another revision.
- New auth or guard work. The existing `AdminGuard` and the backend `PlatformAdminGuard` together cover the access model.

## Decisions

**Decision 1 — One JSON textarea over the whole `content.files` object instead of per-file tabs.**
Rationale: The current set of prompts is small (1 file for search/synthesis, 2 files for the largest skill bundle). A single pretty-printed JSON view is easier to copy-paste between revisions (the roll-forward path), needs no editor library, and matches how the backend stores the value. Per-file tabs would require more state, more validation surface, and a custom JSON renderer for the History tab. The operator is technical (PlatformAdmin); raw JSON is appropriate.
Alternatives considered: a Monaco/CodeMirror editor — rejected, adds a multi-hundred-kB dependency for a niche admin screen. Per-file textareas with tabs — rejected, doubles validation logic with negligible UX gain on the present prompt set.

**Decision 2 — Client-side JSON validation gates the Save button.**
Rationale: The backend returns `400` on invalid input, but a client-side check gives the operator immediate feedback before the round-trip, and prevents the most common typos (trailing comma, unquoted keys). Validation is shallow: `JSON.parse` must succeed, the result must be a non-null object, and every value must be a string. Save is disabled while the parse fails; an inline message names the parse error.
Alternatives considered: server-only validation — rejected, the latency cost is small but the UX cost is real (operators paste, click, wait, get a generic 400). Heavy schema validation (path patterns, file-name shape) — rejected, the backend is the source of truth and adding a client-side schema duplicates logic.

**Decision 3 — Detail view uses tabbed local state (Edit / History) inside one route `/prompts/:name/:agent`, not separate routes.**
Rationale: The other detail pages (UserDetail, OrgDetail, ProjectDetail) follow a single-route layout. Tabs are the smallest delta and let the reader stay on the same URL. The selected history revision lives in local state, not the URL, because operators typically read one or two revisions and move on; deep-linking to a specific revision is out of scope.
Alternatives considered: nested routes `/prompts/:name/:agent/history/:revision` — rejected as overkill for current usage, easy to add later if requested.

**Decision 4 — Pretty-printed JSON (`JSON.stringify(files, null, 2)`) on load; raw textarea content on save.**
Rationale: Operators expect a readable layout when they open a prompt. The textarea preserves their formatting on edit but we re-parse on save, so whitespace differences are not transmitted. The History view always pretty-prints since it is read-only.

**Decision 5 — The "last editor" column shows the raw `createdBy` user id, with no join to fetch the email.**
Rationale: The backend's list endpoint already returns `createdBy` as a user id. Fetching emails would require either a new backend join or a per-row request from the admin client. The simpler placement is showing the id and letting an operator click through to the existing Users page if they need to identify the author. A follow-up can extend the backend response if this proves frequent.
Alternatives considered: per-row email lookup — rejected, N+1 fetches for a list view. Backend change to join — out of scope for this change (frontend-only delivery of an existing spec).

**Decision 6 — Save flow re-fetches the latest revision after `201` instead of trusting the response body.**
Rationale: The POST returns `{ id, revision }`. The list / detail views need full row data (note, createdAt, createdBy, content). Re-fetching `GET /:name/:agent` after save is one extra round-trip but keeps the rendering logic single-sourced: every render reads from the same `PromptRevisionDetail` shape returned by the GET. The success message also includes the new revision number from the POST response so the operator sees confirmation immediately.

**Decision 7 — No optimistic UI on save.**
Rationale: The save is rare (operator-initiated) and the round-trip is short. Showing a spinner and waiting is honest about the state and avoids flickering an unconfirmed revision in the list.

## Risks / Trade-offs

- **Risk: An operator pastes huge content (many KB) that lags the textarea on every keystroke.** → Mitigation: prompt files are markdown of a few KB; the textarea is fine. If skills grow to many tens of KB, switch to a real editor in a follow-up.
- **Risk: JSON validation is shallow; an operator might submit `{ "SKILL.md": 42 }` and trip the backend 400.** → Mitigation: client-side check rejects non-string values; the disabled Save button explains why. Even if the check is bypassed, the backend already returns a clear 400.
- **Risk: The History tab loads all revisions in one shot — large histories could be slow.** → Mitigation: prompts have very few revisions in practice (single-digit). If histories ever balloon, page the backend response in a follow-up.
- **Risk: `createdBy` as a raw uuid is unfriendly.** → Mitigation: accepted trade-off, see Decision 5. The id is precise and linkable; readability is a follow-up cost only if operators complain.
- **Risk: Two operators editing the same prompt at the same time both submit, last one's revision wins on the "latest" pointer but the other's edit is silently buried.** → Mitigation: this is the backend's immutable-history design; both edits are preserved as separate revisions and the lost one is in History. The UI does not need to handle this differently — if it ever proves a problem, add a "submitted while you were editing — refresh?" toast on a 409 (would require backend changes).
- **Trade-off: No per-revision deep links.** Acceptable today; revisions are usually inspected in-context. Adding a route param is a one-liner if requested.

## Migration Plan

- No migrations. Pure frontend addition to `applications/admin/`.
- Deploy: ship the admin app as usual via the existing build/serve pipeline. The new nav tab appears for all admin users; non-PlatformAdmin users see backend 401/403 if they reach the page directly (existing pattern).
- Rollback: revert the change. The backend endpoints remain available and unused.

## Open Questions

- None blocking. Per-file tabs, diff view, deep-link routing, and `createdBy` → email lookup are explicitly deferred to follow-ups gated on operator feedback.
