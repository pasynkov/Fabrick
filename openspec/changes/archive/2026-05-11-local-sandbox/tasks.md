## 1. NestJS Shared Library Setup

- [x] 1.1 Run `nest g lib shared` inside `applications/backend/`, configure tsconfig paths (`@app/shared`)
- [x] 1.2 Create `shared/wiki-page.types.ts` — export `WikiPageData`, `ExistingPage` types (extracted from synthesis processor)
- [x] 1.3 Create `shared/wiki-repository.interface.ts` — export `WIKI_REPOSITORY` symbol and `WikiRepository` interface (findBySlug, findBySlugs, findByProject, upsert, delete)
- [x] 1.4 Create `shared/shared.module.ts` — export SharedModule registering SynthesisImpl and SearchImpl as providers

## 2. Extract SynthesisImpl

- [x] 2.1 Move `synthesis-prompt.txt` content to `shared/synthesis/synthesis-prompt.ts` as `export const SYNTHESIS_SYSTEM_PROMPT`
- [x] 2.2 Create `shared/synthesis/synthesis.impl.ts` — extract `buildContext()`, `synthesize()`, `parseResponse()`, `parseFrontmatter()` from `synthesis.processor.ts`
- [x] 2.3 Refactor `synthesis/synthesis.processor.ts` — delegate to SynthesisImpl (load blobs → pass to buildContext → synthesize → parseResponse → HTTP upsert/delete)
- [x] 2.4 Delete `synthesis/assets/synthesis-prompt.txt` (replaced by TS constant)
- [x] 2.5 Verify synthesis app builds and existing tests pass

## 3. Extract SearchImpl

- [x] 3.1 Create `shared/search/search.impl.ts` — extract 2-step Claude logic (slug selection + answer generation) from `api/search.service.ts`, inject WikiRepository
- [x] 3.2 Create `api/typeorm-wiki.repository.ts` — implement WikiRepository wrapping existing TypeORM `wikiPageRepo` queries
- [x] 3.3 Refactor `api/search.service.ts` — keep auth/org/project/apiKey resolution, delegate search to SearchImpl
- [x] 3.4 Register TypeOrmWikiRepository as WIKI_REPOSITORY provider in api module
- [x] 3.5 Verify api app builds and existing search tests pass

## 4. Sandbox App Scaffold

- [x] 4.1 Create `applications/backend/sandbox/` NestJS app (nest-cli.json, tsconfig, package.json, main.ts)
- [x] 4.2 Create `sandbox/fs-wiki.repository.ts` — implement WikiRepository with MD files + YAML frontmatter at `sandbox-data/pages/`
- [x] 4.3 Create `sandbox/sandbox.module.ts` — import SharedModule, provide FsWikiRepository for WIKI_REPOSITORY

## 5. Sandbox Startup & Auth Bypass

- [x] 5.1 Implement CLI arg parsing in `sandbox/main.ts` (--repos, --org, --project)
- [x] 5.2 On startup: create `sandbox-data/` directory
- [x] 5.3 On startup: write `.fabrick/credentials.yaml` and `.fabrick/config.yaml` in each repo dir
- [x] 5.4 On startup: generate JWT with org/project claims, print FABRICK_TOKEN and FABRICK_API_URL to stdout

## 6. Sandbox Endpoints

- [x] 6.1 `POST /v1/repos/:repoId/context` — accept multipart upload, unzip to `sandbox-data/blobs/<repoId>/wiki/`
- [x] 6.2 `GET /v1/projects/:projectId` — return `{ autoSynthesisEnabled: false, hasApiKey: false }`
- [x] 6.3 `POST /v1/sandbox/synthesize` — read blobs from fs, call SynthesisImpl synchronously, write pages via FsWikiRepository
- [x] 6.4 `POST /v1/orgs/:org/projects/:proj/search` — delegate to SearchImpl with FsWikiRepository
- [x] 6.5 `GET /v1/orgs/:org/projects/:proj/synthesis/file` — read page content from FsWikiRepository, return plain text

## 7. Verify Full Flow

- [x] 7.1 Start sandbox with two test repo dirs, verify startup output (token, config files created)
- [x] 7.2 Run `fabrick push` from both repos against sandbox, verify files in sandbox-data/blobs/
- [x] 7.3 Call `POST /v1/sandbox/synthesize`, verify pages written to sandbox-data/pages/
- [x] 7.4 Call search endpoint with a question, verify answer returned
- [x] 7.5 Run MCP server with sandbox token, verify fabrick_search tool works
