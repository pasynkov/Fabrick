## Why

System prompts (search agent, synthesis agent, `fabrick-*` Claude skill bundles) currently live as TypeScript string literals and Markdown files baked into the deployable. Editing requires a code change and full redeploy, there is no history of what prompt produced a given analytics row, and no centralized place for operators to inspect or roll forward prompt copy. Storing prompts in the database with per-prompt revisions unlocks an admin editing surface, gives analytics a stable reference to the exact prompt revision used, and lays groundwork for future per-agent variants.

## What Changes

- **NEW** Database table `prompt_revisions` keyed by `(name, agent, revision)` with `content` as `jsonb` of the form `{ files: { "<path>": "<text>" } }`. Rows are immutable; "latest" is `MAX(revision)` per `(name, agent)`.
- **NEW** `PromptRepository` interface in `applications/backend/shared/src` plus a token `PROMPT_REPOSITORY`, with two implementations: `DbPromptRepository` (api) and `FilePromptRepository` (sandbox, FS-backed, hard-coded `revision: 1`).
- **NEW** Seed migration inserts `revision: 1` rows for `search`, `synthesis`, `fabrick-analyze`, `fabrick-push` from the current code/skill content.
- **NEW** Admin HTTP API under `/v1/admin/prompts/...` (PlatformAdmin guard) for listing prompts, reading current/specific revisions, reading history, and creating a new revision (POST always inserts `MAX+1`).
- **NEW** Admin console route `/prompts` with a list view, a single-textarea JSON editor over `content.files`, and a view-only history tab.
- **MODIFIED** `SearchImpl` and `SynthesisImpl` accept a `PromptRepository` constructor argument, fetch their prompt by `(name, agent='claude')` at call time, and include `promptRevisionId` in their returned result. The hard-coded `SYSTEM_PROMPT` / `SYNTHESIS_SYSTEM_PROMPT` constants are removed.
- **MODIFIED** `SharedModule` accepts `{ wiki, prompt }` providers via `SharedModule.for(...)` instead of just `forRepository(wikiProvider)`.
- **MODIFIED** `SkillsController` builds the skills zip dynamically from DB on each request: select `agent='claude'` rows whose `name` starts with `fabrick-`, take the latest revision per name, write each `content.files` entry into the zip, and inject `version: 1.<revision>` into the `SKILL.md` frontmatter on the fly. The static `claude-skills.zip` asset is removed.
- **MODIFIED** Analytics: `search_requests` and `token_usage` gain a nullable `prompt_revision_id` column referencing `prompt_revisions(id)`. `SearchService` and `SynthesisService` persist the revision id returned by the impls.
- **MODIFIED** Sandbox app wires `FilePromptRepository` (reading committed Markdown copies under a `prompts/` folder) into `SharedModule.for(...)` so it keeps working without a database.

## Capabilities

### New Capabilities
- `prompts-registry`: DB schema, `PromptRepository` interface and the DB-backed implementation, seeding from current code, and the analytics linkage (`prompt_revision_id` on `search_requests` and `token_usage`).
- `admin-prompts`: Admin HTTP endpoints and admin console UI for listing, viewing (current + history + specific revision), and creating new revisions, gated by PlatformAdmin.

### Modified Capabilities
- `shared-search-impl`: `SearchImpl` constructor takes a `PromptRepository`, fetches the `search` prompt at call time instead of using a baked constant, and returns `promptRevisionId` alongside the existing result.
- `shared-synthesis-impl`: `SynthesisImpl` constructor takes a `PromptRepository`, fetches the `synthesis` prompt at call time, and returns `promptRevisionId` in its result.
- `skills-distribution`: `GET /skills/claude` no longer serves a static asset; it builds the zip from the latest revisions of `fabrick-*` prompts in the database and rewrites each `SKILL.md` frontmatter to include `version: 1.<revision>`.

## Impact

- **Code** — `applications/backend/shared/src/{search,synthesis}/*`, `applications/backend/shared/src/shared.module.ts`, new `applications/backend/shared/src/prompt-repository.interface.ts`.
- **API** — new `applications/backend/api/src/prompts/` module (entity, repository, controller, service), new TypeORM migration for `prompt_revisions` and the two analytics columns, new seed migration, updates to `SkillsController`, `SearchService`, `SynthesisService`, `app.module.ts`, and `entities/{search-request,token-usage}.entity.ts`.
- **Sandbox** — new `applications/backend/sandbox/src/file-prompt.repository.ts`, committed `prompts/` folder with current copies, `sandbox.module.ts` rewire.
- **Admin** — new `applications/admin/src` route, list/detail views, JSON editor component, history tab.
- **Assets** — `applications/backend/api/src/assets/claude-skills.zip` removed; build no longer needs to package it.
- **Dependencies** — none added beyond what is already in the workspace (TypeORM, NestJS, existing zip library used by current `SkillsController` replacement).
- **Behavior** — first deploy runs the seed migration; runtime always reads prompts from the DB. Existing analytics rows keep `prompt_revision_id = NULL`.
