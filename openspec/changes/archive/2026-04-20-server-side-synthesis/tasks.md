## 1. MinIO: add getObject

- [x] 1.1 Add `getObject(bucket: string, key: string): Promise<Buffer>` to `MinioService` — stream to Buffer

## 2. Synthesis prompt asset

- [x] 2.1 Create `applications/backend/api/src/assets/synthesis-prompt.txt` — prompt instructing Claude to return JSON `{ files: { "path": "content" } }` with full synthesis instructions (overview, per-app, cross-cutting files)

## 3. Project entity: synthStatus

- [x] 3.1 Add `synthStatus: string` column (default `'idle'`) to `Project` entity
- [x] 3.2 Add `synthError: string | null` column to `Project` entity for error messages

## 4. Backend: Anthropic SDK

- [x] 4.1 Add `@anthropic-ai/sdk` to `applications/backend/api/package.json` dependencies
- [x] 4.2 Install: `npm install` in backend

## 5. SynthesisService

- [x] 5.1 Create `applications/backend/api/src/synthesis/synthesis.service.ts`
  - `triggerForProject(projectId: string, userId: string): Promise<void>` — sets status to `running`, fires async
  - `runSynthesis(project, orgSlug): Promise<void>` — core: list repos → fetch contexts → build prompt → call Anthropic → parse JSON → putObject each file → set status `done`
  - Error handling: catch all, set `synthStatus = 'error'`, store message in `synthError`
  - Guard: throw `ConflictException` if already `running`

## 6. SynthesisController + Module

- [x] 6.1 Create `applications/backend/api/src/synthesis/synthesis.controller.ts`
  - `POST /projects/:id/synthesis` — `@UseGuards(AnyAuthGuard)`, calls `triggerForProject`, returns 202
  - `GET /projects/:id/synthesis/status` — returns `{ status, error? }`
  - `GET /projects/:id/synthesis` — lists MinIO `{projectSlug}/synthesis/` prefix, returns file contents; 404 if empty
- [x] 6.2 Create `applications/backend/api/src/synthesis/synthesis.module.ts`
- [x] 6.3 Register `SynthesisModule` in `app.module.ts`

## 7. Console: ProjectDetail synthesis UI

- [x] 7.1 Add "Run Synthesis" button to `ProjectDetail.tsx`
- [x] 7.2 On click: `POST /projects/:id/synthesis`, start polling `GET /projects/:id/synthesis/status` every 3s
- [x] 7.3 Show status: idle / running (spinner) / done / error
- [x] 7.4 When done: show "View synthesis" link or inline file list

## 8. Build and verify

- [x] 8.1 Add `ANTHROPIC_API_KEY` to `docker-compose.yml` env section
- [ ] 8.2 Rebuild backend Docker image
- [ ] 8.3 Run synthesis end-to-end: push context → trigger via console → verify MinIO has `synthesis/` files
