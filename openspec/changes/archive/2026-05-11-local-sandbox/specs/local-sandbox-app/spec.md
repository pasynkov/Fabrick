## ADDED Requirements

### Requirement: Sandbox accepts startup configuration
Sandbox main.ts SHALL accept CLI arguments: `--repos <paths>` (comma-separated repo directories), `--org <slug>`, `--project <slug>`. It SHALL validate that repo paths exist.

#### Scenario: Valid startup
- **WHEN** sandbox starts with `--repos ~/repo-a,~/repo-b --org demo --project demo`
- **THEN** sandbox initializes data directory and starts HTTP server on port 3001

#### Scenario: Invalid repo path
- **WHEN** sandbox starts with a repo path that does not exist
- **THEN** sandbox exits with an error message

### Requirement: Sandbox creates credentials and config in repo dirs on startup
On startup, sandbox SHALL write `.fabrick/credentials.yaml` and `.fabrick/config.yaml` in each specified repo directory. Credentials SHALL contain a dummy token and `api_url: http://localhost:3001`. Config SHALL contain `repo_id` equal to the folder name slug, `project_id`, and `api_url`.

#### Scenario: Credentials created for repo
- **WHEN** sandbox starts with `--repos ~/dev/my-api`
- **THEN** `~/dev/my-api/.fabrick/credentials.yaml` contains `token: sandbox-token` and `api_url: http://localhost:3001`
- **AND** `~/dev/my-api/.fabrick/config.yaml` contains `repo_id: my-api` and `project_id: demo` and `api_url: http://localhost:3001`

### Requirement: Sandbox generates and prints MCP token
On startup, sandbox SHALL generate a JWT with `{ org, project }` claims (signed with any secret) and print `FABRICK_TOKEN=fbrk_<jwt>` and `FABRICK_API_URL=http://localhost:3001` to stdout.

#### Scenario: MCP token is decodable
- **WHEN** MCP server receives the printed FABRICK_TOKEN
- **AND** calls `jsonwebtoken.decode()` on it
- **THEN** decoded payload contains `org` and `project` string claims

### Requirement: Sandbox push endpoint unzips wiki to filesystem
`POST /v1/repos/:repoId/context` SHALL accept multipart file upload, unzip the wiki content to `sandbox-data/blobs/<repoId>/wiki/`. No auth guard.

#### Scenario: Push repo-a wiki
- **WHEN** CLI sends POST with zipped wiki to `/v1/repos/repo-a/context`
- **THEN** wiki files appear at `sandbox-data/blobs/repo-a/wiki/`

### Requirement: Sandbox project settings endpoint returns safe defaults
`GET /v1/projects/:projectId` SHALL return `{ autoSynthesisEnabled: false, hasApiKey: false }` for any projectId. No auth guard.

#### Scenario: CLI checks project settings
- **WHEN** CLI calls `GET /v1/projects/demo`
- **THEN** receives `{ autoSynthesisEnabled: false, hasApiKey: false }`
- **AND** CLI does not prompt for synthesis trigger

### Requirement: Sandbox synthesize endpoint runs synchronously
`POST /v1/sandbox/synthesize` SHALL read all wiki files from `sandbox-data/blobs/*/wiki/`, call `SynthesisImpl.buildContext()` and `SynthesisImpl.synthesize()`, parse the response, and write pages via `FsWikiRepository`. It SHALL return `{ pages: <count>, status: "done" }`. Requires `ANTHROPIC_API_KEY` env var.

#### Scenario: Synthesize two repos
- **WHEN** sandbox-data/blobs/ contains repo-a/wiki/ and repo-b/wiki/ with MD files
- **AND** POST /v1/sandbox/synthesize is called
- **THEN** synthesis runs synchronously, pages are written to sandbox-data/pages/, response is `{ pages: N, status: "done" }`

#### Scenario: No wiki files found
- **WHEN** sandbox-data/blobs/ is empty
- **AND** POST /v1/sandbox/synthesize is called
- **THEN** returns error indicating no wiki files found

### Requirement: Sandbox search endpoint uses SearchImpl
`POST /v1/orgs/:org/projects/:proj/search` SHALL accept `{ question }` body and delegate to `SearchImpl.search()` using `FsWikiRepository`. No auth guard. Requires `ANTHROPIC_API_KEY` env var.

#### Scenario: Search after synthesis
- **WHEN** sandbox-data/pages/ contains synthesized wiki pages including index.md
- **AND** POST /v1/orgs/demo/projects/demo/search with `{ question: "how does auth work?" }`
- **THEN** returns `{ answer: "...", sources: ["flows/auth", ...] }`

### Requirement: Sandbox synthesis file endpoint serves page content
`GET /v1/orgs/:org/projects/:proj/synthesis/file?path=<slug>` SHALL read page content from FsWikiRepository and return it as plain text. Used by MCP for tool description.

#### Scenario: MCP requests tool description
- **WHEN** MCP calls `GET /v1/orgs/demo/projects/demo/synthesis/file?path=mcp-description`
- **AND** sandbox-data/pages/mcp-description.md exists
- **THEN** returns page content as plain text

### Requirement: FsWikiRepository stores pages as MD with frontmatter
`FsWikiRepository` SHALL implement `WikiRepository`. Pages stored as MD files at `sandbox-data/pages/<slug>.md` with YAML frontmatter (slug, category, title, sources, related). Nested slugs create subdirectories (e.g., `entities/user` → `sandbox-data/pages/entities/user.md`).

#### Scenario: Upsert creates MD file with frontmatter
- **WHEN** upsert is called with a page `{ slug: "entities/user", category: "entities", title: "User", content: "...", sources: [...], related: [...] }`
- **THEN** file `sandbox-data/pages/entities/user.md` is created with YAML frontmatter and content

#### Scenario: findBySlug reads and parses MD file
- **WHEN** findBySlug is called with slug "entities/user"
- **THEN** reads `sandbox-data/pages/entities/user.md`, parses frontmatter, returns WikiPage object

#### Scenario: delete removes MD file
- **WHEN** delete is called with slugs ["old-page"]
- **THEN** `sandbox-data/pages/old-page.md` is deleted from disk
