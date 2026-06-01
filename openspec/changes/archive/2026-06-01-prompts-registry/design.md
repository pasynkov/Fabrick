## Context

Prompts used by the production agentic flows currently live as string constants in `applications/backend/shared/src/{search,synthesis}/...` and as Markdown files under `applications/cli/src/skills/fabrick-*` that are pre-packaged into `applications/backend/api/src/assets/claude-skills.zip`. Two surfaces consume the shared impls today: the api (DB-backed wiki) and the sandbox (FS-backed wiki, no Postgres). Analytics (`search_requests`, `token_usage`) records token spend and outcomes but has no way to attribute a row to the prompt copy that produced it. There is no operator UI to inspect or edit prompts, so any tweak ships as a code release.

The change introduces a single canonical store (DB) for prompts, exposes a `PromptRepository` boundary that both deployables can satisfy (DB for api, FS for sandbox), adds an immutable revision history, and threads the active `promptRevisionId` through the search/synthesis result types so analytics rows can pin it. The skills zip endpoint becomes a thin transformer over the same store.

## Goals / Non-Goals

**Goals:**
- One canonical place (the `prompt_revisions` table) for every system prompt used in production, addressable by `(name, agent, revision)`.
- Immutable revisions; new content always lands as `MAX(revision) + 1`. Latest is a query, not a flag.
- Operators (PlatformAdmin) can list, view current, view any historical revision, and create new revisions from the admin console without a code deploy.
- Analytics rows produced by search and synthesis carry a foreign key to the exact revision they used.
- `fabrick-*` skill bundles served to Claude Code are assembled from the same store and carry a `version: 1.<revision>` line in `SKILL.md` frontmatter so the agent sees which revision it received.
- Sandbox keeps working without a database (FS-backed `PromptRepository`).

**Non-Goals:**
- Sandbox ↔ api sync: out of scope. Sandbox reads from a committed `prompts/` folder; bringing those copies up to date is a manual edit until a follow-up change.
- Multi-major versioning. The `version:` field is hard-coded as `1.<rev>`; there is no story for bumping the major.
- Caching. Every search/synthesis call performs one `getLatest` DB query, and `/skills/claude` rebuilds the zip per request. Adding a cache is a future optimization, gated by measured cost.
- Diff view between revisions or one-click rollback. Rollback is "POST the older content as a new revision."
- Per-environment overrides (e.g., staging vs prod prompt). One row per `(name, agent)` is global.

## Decisions

**Decision 1 — Single `prompt_revisions` table with `content` as `jsonb {files}` rather than two tables (text prompts vs multi-file bundles).**
Rationale: Single-string prompts and multi-file skill bundles have the same lifecycle (named, agent-scoped, revised, immutable). Forcing a second table doubled the schema, the repository interface, and the admin UI for no extra expressivity. Storing the payload as `jsonb` with a `files` map keeps everything uniform — a one-file `{ "prompt.md": "..." }` for `search` and a two-file `{ "SKILL.md": "...", "patterns.md": "..." }` for `fabrick-analyze` use the same code path.
Alternatives considered: separate `prompts` (text) and `skill_bundles` (multi-file) tables — rejected, too much duplication. `content` as plain `text` plus a `kind` column — rejected, can't fit multi-file without re-inventing JSON.

**Decision 2 — DB is the runtime source of truth; code constants are seed-only and removed after the seed migration runs.**
Rationale: If code and DB both hold prompts, every edit creates a divergence question. Picking one source eliminates that. DB wins because: (a) admins can edit it without a deploy, (b) revision history lives there anyway, (c) analytics already references DB rows. The current code constants are migrated in once via a seed migration and then deleted from the source tree in the same change.
Alternatives considered: code-as-source-of-truth with DB only used for analytics — rejected, defeats the whole admin UI goal.

**Decision 3 — `PromptRepository` interface with two implementations: `DbPromptRepository` (api) and `FilePromptRepository` (sandbox).**
Rationale: Sandbox does not run Postgres and must keep its zero-infra story. A repository boundary keeps `SearchImpl`/`SynthesisImpl` agnostic. `FilePromptRepository` reads from a committed `prompts/` directory and returns `revision: 1` with a deterministic `id` (e.g., `sha256(name + agent + content)` truncated) so the impls' return type stays well-formed even though sandbox doesn't persist analytics.
Alternatives considered: `SearchImpl` reads prompts itself via different code paths — rejected, leaks deployment shape into the impl. Sandbox calls api over HTTP for prompts — rejected, adds runtime dependency where the explicit goal is no infra.

**Decision 4 — `SearchImpl` / `SynthesisImpl` return `promptRevisionId` as part of their result; persistence is the caller's job.**
Rationale: The impls already return rich result objects (`{ answer, sources, metrics }`). Adding one more field keeps them pure and lets the api-side service decide where to write it (currently `search_requests` row + zero or more `token_usage` rows). The impls themselves stay storage-agnostic, which is what makes the sandbox case work.
Alternatives considered: impls write the analytics rows directly — rejected, breaks the layering, breaks the sandbox.

**Decision 5 — `POST /v1/admin/prompts/:name/:agent` always inserts; there is no `PUT`.**
Rationale: Revisions are immutable. Edit semantics are "submit the new full payload, get a new revision number." This collapses optimistic concurrency control to nothing — two simultaneous saves both land as new revisions, last commit wins on the "latest" pointer but no edit is lost.
Alternatives considered: `PUT` with optimistic locking on a `version` column — rejected, more code, more edge cases, and the immutable-history goal wants every edit preserved anyway.

**Decision 6 — Skills zip built per request from DB; no static asset.**
Rationale: The static `claude-skills.zip` would have to be regenerated and redeployed on every prompt edit, which contradicts the "edit without deploy" goal. Zipping a handful of small Markdown files is trivial (`<10 KB` total today, single-digit ms). The frontmatter rewrite (`version: 1.<rev>`) is a one-line regex on `SKILL.md`. The existing `gray-matter` style parsing is overkill; a stable regex on the leading `---\n...\n---` block keeps the implementation small.
Alternatives considered: rebuild the zip on each prompt save and cache it on disk — rejected, more moving parts (cache invalidation, multi-replica consistency) than the simple rebuild.

**Decision 7 — Analytics columns are added as `nullable` and back-fill is `NULL`.**
Rationale: Existing `search_requests` / `token_usage` rows have no prompt revision to attribute them to. Forcing a non-null column would require either a fake "unknown" revision or a no-op back-fill against the seed revision (which is misleading — those rows didn't actually use revision 1, they used the now-deleted code constant). `NULL` accurately reflects "unknown". New rows are non-null in practice but the column itself stays nullable to keep the FK simple.

**Decision 8 — `version: 1.<rev>` injected into `SKILL.md` frontmatter only, not into stored content.**
Rationale: The stored `SKILL.md` content does not carry a `version:` line. The version is a property of the revision, not the file body, and storing it in the body would force the seed migration to know the future revision number. Inject at serve time: parse frontmatter on read, splice `version: 1.<revision>`, re-emit. Other files (`patterns.md`) are untouched.

## Risks / Trade-offs

- **Risk: A prompt edit ships a broken prompt to production with no review step.** → Mitigation: PlatformAdmin guard restricts who can edit. Operationally, follow-up changes can add a "preview against fixture" button; out of scope here. The history table lets us revert by POSTing the prior content as a new revision.
- **Risk: One DB query per `SearchImpl.search()` call adds latency on the critical path.** → Mitigation: `prompt_revisions` is tiny (handful of rows, small content), indexed on `(name, agent, revision DESC)`. Cost is well under typical Anthropic API latency. If it ever shows up in flame graphs, add a TTL cache behind the same `PromptRepository` interface without touching impls.
- **Risk: Skills zip rebuilt per request becomes noisy under high CLI traffic.** → Mitigation: `fabrick init` is called rarely (project bootstrap) and the zip is small. If `GET /skills/claude` ever becomes hot, gate it behind the same TTL cache as above.
- **Risk: Sandbox `FilePromptRepository` drifts from the DB copies and developers debug against stale prompts.** → Mitigation: Sandbox is explicitly a developer fixture, not a deploy target. The committed `prompts/` folder is documented as "manually mirrored from DB; refresh on demand". A follow-up change can automate the mirror.
- **Risk: Seed migration races a parallel admin edit on first deploy.** → Mitigation: Seed migration uses `INSERT ... ON CONFLICT (name, agent, revision) DO NOTHING` and only ever writes `revision: 1`, so re-runs are idempotent and admin-created revisions live at `>= 2`. No race window.
- **Trade-off: Frontmatter rewriting via regex** assumes the leading `---\n...\n---` block format. If a future skill author drops the leading block, the regex no-ops and `version:` is silently missing. Acceptable; the seed content controls the shape and an admin-created skill that breaks frontmatter is operator-visible immediately.
- **Trade-off: `(name, agent)` is global**, no per-tenant overrides. Acceptable today: all tenants run the same prompts. If multi-tenant variants are ever needed, add `org_id NULL` to the unique constraint as a non-breaking change.

## Migration Plan

1. Ship the change with the `prompt_revisions` schema migration **and** the seed migration in the same release.
2. Boot order on first deploy: TypeORM runs both migrations before the app accepts traffic. The seed migration reads the prompt strings/files (vendored into the migration file as TypeScript constants, captured at migration-write time so the migration is self-contained) and inserts `revision: 1`.
3. The code constants `SYSTEM_PROMPT` / `SYNTHESIS_SYSTEM_PROMPT` and the `claude-skills.zip` asset are deleted from the source tree in the same release. The api boots wired to `DbPromptRepository`; if the seed didn't run for some reason, `SearchImpl.search()` throws "no prompt found" at first call — a loud failure mode is preferred to falling back to a stale constant.
4. Sandbox: the same release commits a `prompts/` folder with copies of the same content and wires `FilePromptRepository`. Sandbox doesn't run the migration.
5. Rollback: revert the release. The `prompt_revisions` table can be left in place; the prior code uses the constants and never queries the table. Analytics columns are nullable so the prior code reads/writes those tables unaffected.

## Open Questions

- None blocking. Cache layer, sandbox auto-sync, and richer admin UX (diff, rollback button) are explicitly deferred.
