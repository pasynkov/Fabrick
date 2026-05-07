## 1. Database

- [ ] 1.1 Create `SynthesisPage` TypeORM entity (`src/entities/synthesis-page.entity.ts`) with fields: id, project_id FK, slug, category, title, content, sources (text array), updated_at; UNIQUE(project_id, slug)
- [ ] 1.2 Create migration `1746000000000-AddSynthesisPages.ts` — CREATE TABLE synthesis_pages with all columns and unique constraint
- [ ] 1.3 Register `SynthesisPage` entity in `AppModule` and `SynthesisModule`

## 2. API — Internal Upsert Endpoint

- [ ] 2.1 Add `PUT /internal/synthesis/pages` route to `SynthesisController` accepting `{ projectId, pages[] }` body
- [ ] 2.2 Validate callbackToken (scope: "synth-callback", sub === projectId) — reuse existing token validation logic from `updateStatusFromCallback`
- [ ] 2.3 Implement upsert in `SynthesisService`: INSERT INTO synthesis_pages ... ON CONFLICT (project_id, slug) DO UPDATE
- [ ] 2.4 Add request DTO (`UpsertSynthesisPagesDto`) with page array validation

## 3. API — Public Read Endpoints

- [ ] 3.1 Change `getSynthesisFileBySlug` in `SynthesisService` to query `synthesis_pages WHERE project_id = ? AND slug = filePath` instead of blob storage; throw NotFoundException if not found
- [ ] 3.2 Add `GET /orgs/:org/projects/:project/synthesis/pages` route returning `{ pages: [{ slug, category, title, sources, updated_at }] }` (no content field)
- [ ] 3.3 Add unit tests for updated `getSynthesisFileBySlug` (DB hit, 404 path)
- [ ] 3.4 Add unit tests for `PUT /internal/synthesis/pages` (valid token, invalid token, sub mismatch)

## 4. Synthesis Worker — Prompt Redesign

- [ ] 4.1 Rewrite synthesis LLM prompt to output JSON array `[{ slug, category, title, content, sources }]` organized by taxonomy (index, entities/*, services/*, flows/*, contracts/*)
- [ ] 4.2 Add prompt instructions: always include `slug: "index"` page; cross-reference pages by slug in content; `sources` = repo slugs that contributed to each page
- [ ] 4.3 Wrap LLM response parsing in try/catch; on parse failure call existing status callback with `{ status: "error", error: "LLM output parse failed" }`

## 5. Synthesis Worker — Page Upsert Call

- [ ] 5.1 After successful LLM parse, call `PUT /internal/synthesis/pages` with `{ projectId, pages }` and `Authorization: Bearer <callbackToken>`
- [ ] 5.2 Remove blob storage write for synthesis output (keep blob reads for raw context)
- [ ] 5.3 Update synthesis worker tests to assert pages sent to upsert endpoint, not written to blob

## 6. Verification

- [ ] 6.1 Run migration locally, trigger synthesis on test project, verify pages appear in `synthesis_pages` table
- [ ] 6.2 Call `GET /synthesis/file?path=index` via MCP tool, verify index page returned
- [ ] 6.3 Call `GET /synthesis/file?path=entities/User` (or similar), verify concept page returned
- [ ] 6.4 Verify `GET /synthesis/pages` lists all pages without content
