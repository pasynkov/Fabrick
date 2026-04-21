## 1. API — Enrich Queue Message

- [x] 1.1 In `synthesis.service.ts` `triggerForProject`: fetch repos for project, generate capability JWT `{ sub: projectId, scope: "synth-callback", exp: now+1h }`, build enriched payload `{ projectId, orgSlug, projectSlug, repos: [{ id, slug }], callbackToken }`, publish to queue
- [x] 1.2 Add `POST /internal/synthesis/status` endpoint — validate JWT signature + `scope === "synth-callback"` + `token.sub === body.projectId`, update project `synthStatus`

## 2. Synthesis — Remove DB

- [x] 2.1 Rewrite `synthesis.processor.ts`: use queue payload fields directly for MinIO paths, remove all `@InjectRepository` / DB calls
- [x] 2.2 Replace `projectRepo.update(status)` calls with HTTP POST to `API_BASE_URL/internal/synthesis/status`
- [x] 2.3 Remove TypeORM from `synthesis/src/app.module.ts` — delete `TypeOrmModule.forRootAsync`, entity imports
- [x] 2.4 Delete `synthesis/src/entities/` directory

## 3. Config

- [x] 3.1 Add `API_BASE_URL` to synthesis service in `docker-compose.yml`
