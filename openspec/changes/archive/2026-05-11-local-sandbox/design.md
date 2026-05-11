## Context

Fabrick's pipeline (scan → push → synthesize → search) currently requires full infrastructure: Postgres, Azure Blob, NATS, JWT auth. Testing end-to-end means `docker-compose up` with 5 services. This makes iteration slow and debugging painful.

Production code is tightly coupled to infrastructure — `SearchService` queries TypeORM directly, `SynthesisProcessor` reads from Azure Blob and writes via HTTP callbacks, auth guards wrap every endpoint.

Current architecture:
```
CLI → (HTTP+JWT) → API (TypeORM+Blob+NATS) → Synthesis Worker (Blob+HTTP callbacks)
MCP → (HTTP+JWT) → API → Search (TypeORM+Claude)
```

## Goals / Non-Goals

**Goals:**
- Extract reusable core logic (synthesis, search) into shared NestJS library
- Create sandbox NestJS app that runs full flow with filesystem storage, no auth, no queues
- CLI and MCP work unchanged against sandbox (same HTTP API surface)
- Production services refactored to use shared impls — zero behavior change

**Non-Goals:**
- Replacing or abstracting Azure Blob storage globally (stays in synthesis/api apps)
- Abstracting queue system (NATS/Service Bus stay in their apps)
- Adding sandbox to CI/CD or Docker
- Supporting multi-user or concurrent sandbox sessions
- Persisting sandbox state across restarts

## Decisions

### 1. WikiRepository as the core abstraction

Repository pattern with NestJS DI token `WIKI_REPOSITORY`.

```typescript
export const WIKI_REPOSITORY = Symbol('WIKI_REPOSITORY');

export interface WikiRepository {
  findBySlug(projectId: string, slug: string): Promise<WikiPage | null>;
  findBySlugs(projectId: string, slugs: string[]): Promise<WikiPage[]>;
  findByProject(projectId: string): Promise<WikiPage[]>;
  upsert(projectId: string, pages: WikiPageData[]): Promise<void>;
  delete(projectId: string, slugs: string[]): Promise<void>;
}
```

Three implementations stay in their respective apps:
- **TypeORM** (api) — existing `wikiPageRepo` queries wrapped
- **HTTP** (synthesis) — existing fetch calls to API callback endpoints wrapped
- **FS** (sandbox) — MD files with YAML frontmatter in `sandbox-data/pages/`

**Why not a single shared StorageInterface for both blobs and pages?** Different access patterns. Blob storage is key/value bytes (put/get/list). Wiki pages are structured data with queries by slug/project. Merging them creates a leaky abstraction.

### 2. SynthesisImpl accepts pre-loaded wiki data

```typescript
@Injectable()
export class SynthesisImpl {
  buildContext(
    repoWikis: { slug: string; files: { path: string; content: string }[] }[],
    existingPages: ExistingPage[],
    changedRepos: string[],
  ): string;

  async synthesize(context: string, apiKey: string): Promise<string>;

  parseResponse(raw: string): { pages: WikiPageData[]; deleteSlugs: string[] };
}
```

Caller loads wiki files however it wants (blob in synthesis, fs in sandbox), then passes to `buildContext()`. SynthesisImpl has no storage dependency.

**Why not inject ObjectStorage?** Would require fs-object-storage in shared, and synthesis app already has BlobStorage that works fine. Adding another abstraction layer just for sandbox is overengineering.

### 3. SearchImpl injects WikiRepository

```typescript
@Injectable()
export class SearchImpl {
  constructor(@Inject(WIKI_REPOSITORY) private readonly wikiRepo: WikiRepository) {}

  async search(projectId: string, question: string, apiKey: string): Promise<{ answer: string; sources: string[] }>;
}
```

Search prompts (slug selection system prompt, answer generation system prompt) stay inline in SearchImpl. No separate prompt files.

**Why different from SynthesisImpl?** Search needs to query pages (findBySlug, findBySlugs) mid-execution. Passing pre-loaded data would require loading ALL pages upfront. Repository injection is cleaner — search loads what it needs when it needs it.

### 4. Synthesis prompt as TS constant

```typescript
// shared/synthesis/synthesis-prompt.ts
export const SYNTHESIS_SYSTEM_PROMPT = `...`;
```

Replaces `readFileSync(join(__dirname, '..', 'assets', 'synthesis-prompt.txt'))`. No path resolution, no runtime file reads, importable anywhere.

### 5. Sandbox as NestJS app with same HTTP surface

Sandbox exposes 5 endpoints matching production API paths:

| Endpoint | Production | Sandbox |
|----------|-----------|---------|
| `POST /v1/repos/:repoId/context` | Auth + Blob + DB hash check | No auth, unzip to fs |
| `GET /v1/projects/:projectId` | DB query + auth | Returns static `{ autoSynthesisEnabled: false, hasApiKey: false }` |
| `POST /v1/sandbox/synthesize` | N/A (queue-based in prod) | Synchronous: read blobs → SynthesisImpl → fs-wiki |
| `POST /v1/orgs/:org/projects/:proj/search` | Auth + DB + SearchImpl | SearchImpl with fs-wiki |
| `GET /v1/orgs/:org/projects/:proj/synthesis/file` | Auth + DB page lookup | Read from fs-wiki pages |

**Why same HTTP paths?** CLI and MCP hardcode these paths. Same paths = zero changes to CLI/MCP.

### 6. Startup configuration via CLI args

```bash
npm run sandbox -- --repos ~/dev/repo-a,~/dev/repo-b --org demo --project demo
```

On startup, sandbox:
1. Creates `sandbox-data/` in CWD
2. For each repo path: writes `.fabrick/credentials.yaml` (dummy token, `api_url: http://localhost:3001`) and `.fabrick/config.yaml` (`repo_id: <folder-name>`, `project_id: <project>`, `api_url: http://localhost:3001`)
3. Signs JWT with sandbox secret containing `{ org, project }` claims — valid for `jsonwebtoken.decode()`
4. Prints setup info to stdout (FABRICK_TOKEN, FABRICK_API_URL, MCP config JSON)
5. Starts HTTP server on port 3001

**Why `repo_id = folder slug`?** Sandbox has no DB for UUID generation. Slug from folder name is deterministic and human-readable. Sandbox controller maps repoId param to filesystem path.

### 7. NestJS monorepo library

`nest g lib shared` inside `applications/backend/`. This gives:
- `SharedModule` exportable to api, synthesis, sandbox
- tsconfig paths (`@app/shared`) for clean imports
- DI-friendly providers registered in module

**Why not a standalone npm package?** Overkill for internal sharing between 3 apps in the same directory. NestJS lib is lighter, no publish step, no version management.

## Risks / Trade-offs

**[Risk] Refactoring search/synthesis breaks production** → Mitigation: existing tests must pass after refactoring. Extract logic into impl, then make original service a thin wrapper that delegates. No behavior change.

**[Risk] Shared lib becomes a dumping ground** → Mitigation: strict scope — only WikiRepository interface, SynthesisImpl, SearchImpl, types, prompt. No storage implementations, no auth, no queue logic.

**[Risk] FS wiki repository diverges from TypeORM behavior** → Mitigation: WikiRepository interface is the contract. Both impls satisfy same interface. Edge cases (e.g., concurrent writes) are non-goals for sandbox.

**[Trade-off] Sandbox doesn't test auth/queue paths** → Acceptable. Sandbox tests core logic flow. Auth and queue are tested via existing unit/e2e tests.

**[Trade-off] Synthesis runs synchronously in sandbox** → Acceptable for local dev. Production async behavior tested separately.
