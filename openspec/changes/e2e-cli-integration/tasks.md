## 1. CLI Headless Flags

- [ ] 1.1 Add `--token <token>` option to `LoginCommand`: when present, skip callback server, write credentials with token + api_url (from `FABRICK_API_URL` or default), exit 0
- [ ] 1.2 Add `--non-interactive` boolean option to `InitCommand`
- [ ] 1.3 Add `--org <slug>` and `--project <slug>` string options to `InitCommand`
- [ ] 1.4 Implement non-interactive branch in `InitCommand.run()`: resolve org by slug from `/orgs` list, resolve/create project by slug, call find-or-create with git remote, default AI tool to `claude`, write config — fail fast with clear error if org not found

## 2. CLI Test Infrastructure

- [ ] 2.1 Add `@azure/storage-blob` to `devDependencies` in `applications/cli/package.json`
- [ ] 2.2 Create `applications/cli/jest.e2e.config.js` targeting `test/**/*.e2e.spec.ts` with 60s timeout and `testEnvironment: node`
- [ ] 2.3 Add `"test:e2e": "jest --config jest.e2e.config.js"` to `applications/cli/package.json` scripts

## 3. Integration Test

- [ ] 3.1 Create `applications/cli/test/integration.e2e.spec.ts`
- [ ] 3.2 Implement `beforeAll`: register user → get access_token → get cli-token → create org → create project → find-or-create repo → get mcp-token; set up temp working dir with `git init && git remote add origin`
- [ ] 3.3 Implement Azurite synthesis seed in `beforeAll`: use `BlobServiceClient` to upload `"# Mock synthesis"` to `orgSlug` container at `projectSlug/synthesis/index.md`
- [ ] 3.4 Implement `afterAll`: clean up temp working dir
- [ ] 3.5 Add test: `fabrick login --token` — spawn CLI subprocess, assert exit 0, assert `.fabrick/credentials.yaml` contains token and api_url
- [ ] 3.6 Add test: `fabrick init --non-interactive` — spawn CLI subprocess, assert exit 0, assert `.fabrick/config.yaml` contains correct repo_id
- [ ] 3.7 Add test: `fabrick push` — create `.fabrick/context/mock.md`, spawn CLI subprocess, assert exit 0
- [ ] 3.8 Add test: MCP stdio — spawn `node mcp/dist/index.js` with FABRICK_TOKEN + FABRICK_API_URL env, write initialize frame, read response, write notifications/initialized, write tools/call get_synthesis_index, assert response `content[0].text === "# Mock synthesis"`

## 4. CI Job

- [ ] 4.1 Add `e2e-cli` job to `.github/workflows/cd-release.yml` with `needs: [e2e-api]`
- [ ] 4.2 Configure `postgres` and `azurite` service containers in the job
- [ ] 4.3 Add steps: checkout, setup-node 24, build API, start API in background, `npx wait-on http://localhost:3000/health`
- [ ] 4.4 Add steps: build CLI (`npm ci && npm run build` in `applications/cli`), build MCP (`npm ci && npm run build` in `applications/mcp`)
- [ ] 4.5 Add step: run `npm run test:e2e` in `applications/cli` with all required env vars (DB_*, JWT_SECRET, AZURE_STORAGE_CONNECTION_STRING, MCP_DIST_PATH)
