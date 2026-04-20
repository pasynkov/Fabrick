## 1. Infrastructure: Postgres + docker-compose

- [x] 1.1 Add Postgres 16 service to `applications/backend/docker-compose.yml` with healthcheck and volume
- [x] 1.2 Add NestJS API `depends_on: postgres: condition: service_healthy`
- [x] 1.3 Install TypeORM + pg driver: `@nestjs/typeorm typeorm pg`
- [x] 1.4 Configure `TypeOrmModule.forRootAsync` in `AppModule` using env vars `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`; `synchronize: true` for dev
- [x] 1.5 Add DB env vars to docker-compose API service

## 2. Entities

- [x] 2.1 Create `User` entity: `id (uuid), email (unique), passwordHash, createdAt`
- [x] 2.2 Create `Organization` entity: `id (uuid), name, slug (unique), createdAt`
- [x] 2.3 Create `OrgMember` entity: `orgId, userId, role (admin|member)` — composite PK
- [x] 2.4 Create `Project` entity: `id (uuid), name, slug, orgId, createdAt` — slug unique per org
- [x] 2.5 Create `Repository` entity: `id (uuid), name, slug, gitRemote (unique), projectId, createdAt`
- [x] 2.6 Create `CliToken` entity: `id (uuid), userId, tokenHash (unique), createdAt`

## 3. Auth Module

- [x] 3.1 Install `@nestjs/jwt @nestjs/passport passport passport-jwt bcrypt`
- [x] 3.2 Implement `POST /auth/register` — hash password, create user, create default org, create MinIO bucket, return JWT
- [x] 3.3 Implement `POST /auth/login` — verify password, return JWT
- [x] 3.4 Implement JWT strategy + `JwtAuthGuard`
- [x] 3.5 Implement `POST /auth/cli-token` (JWT-guarded) — generate 32-byte random token, store SHA-256 hash in `cli_tokens`, return plaintext
- [x] 3.6 Implement CLI token strategy + `CliTokenGuard` — hash incoming token, look up in DB, inject user
- [x] 3.7 Configure CORS in `main.ts` to allow `http://localhost:5173`

## 4. Org Management Module

- [x] 4.1 Implement `POST /orgs` (JWT-guarded) — create org, derive slug, create MinIO bucket, add requester as admin
- [x] 4.2 Implement `GET /orgs` (JWT-guarded) — list user's orgs with roles
- [x] 4.3 Implement `POST /orgs/:orgId/members` (JWT-guarded, admin-only) — create user if not exists, add as member
- [x] 4.4 Implement `GET /orgs/:orgId/members` (JWT-guarded, org members only)
- [x] 4.5 Add org membership guard/decorator for reuse across modules

## 5. Project & Repo Module

- [x] 5.1 Implement `POST /orgs/:orgId/projects` (JWT-guarded, org members) — create project with slug
- [x] 5.2 Implement `GET /orgs/:orgId/projects` (JWT-guarded, org members)
- [x] 5.3 Implement `POST /projects/:projectId/repos` (JWT-guarded, org members) — normalize git remote, create repo
- [x] 5.4 Implement `GET /projects/:projectId/repos` (JWT-guarded, org members)
- [x] 5.5 Implement `POST /repos/find-or-create` (CLI-token-guarded) — normalize remote, find or create repo
- [x] 5.6 Implement git remote normalization utility: strip protocol + `.git`, normalize SSH to HTTPS-style path

## 6. Context Upload Endpoint (updated)

- [x] 6.1 Move context endpoint from `/context/:repo` to `/repos/:repoId/context`
- [x] 6.2 Apply `CliTokenGuard` to the endpoint
- [x] 6.3 Resolve org/project/repo slugs from `repoId`, build MinIO path `<org-slug>/<project-slug>/<repo-slug>/context/<filepath>`
- [x] 6.4 Remove startup `fabrick` bucket creation (replaced by per-org bucket creation in OrgService)

## 7. Console SPA

- [x] 7.1 Scaffold `applications/console/` with Vite + React + Tailwind (`npm create vite`, add Tailwind)
- [x] 7.2 Set up React Router with routes: `/login`, `/register`, `/cli-auth`, `/`, `/orgs/:orgSlug`, `/orgs/:orgSlug/projects/:projectSlug`
- [x] 7.3 Implement auth context — store JWT in sessionStorage, `useAuth` hook, protected route wrapper
- [x] 7.4 Implement `/login` page — email/password form, call `POST /auth/login`, store token
- [x] 7.5 Implement `/register` page — email/password form, call `POST /auth/register`
- [x] 7.6 Implement `/cli-auth` page — read `port`/`state` from query, call `POST /auth/cli-token`, redirect to localhost callback
- [x] 7.7 Implement `/` org list page — call `GET /orgs`, display list with links
- [x] 7.8 Implement `/orgs/:orgSlug` page — projects list + admin member management (add member form with generated password shown once)
- [x] 7.9 Implement `/orgs/:orgSlug/projects/:projectSlug` page — repos list

## 8. CLI Rewrite (TypeScript + nest-commander)

- [x] 8.1 Set up new TypeScript project in `applications/cli/` — `tsconfig.json`, `package.json` with `@nestjs/core`, `@nestjs/common`, `nest-commander`, `typescript`
- [x] 8.2 Create NestJS CLI app bootstrap: `NestFactory.createApplicationContext(CliModule)`
- [x] 8.3 Implement `CredentialsService` — read/write `~/.fabrick/credentials.yaml` (permissions 0600)
- [x] 8.4 Implement `ApiService` — HTTP client wrapping fetch with CLI token auth header
- [x] 8.5 Implement `LoginCommand` — start local HTTP server on random port, open browser, wait for callback, save credentials
- [x] 8.6 Implement `InitCommand` — verify credentials, get git remote, fetch orgs/projects interactively, call `POST /repos/find-or-create`, write `.fabrick/config.yaml`
- [x] 8.7 Implement `PushCommand` — read config, zip `.fabrick/context/`, `POST /repos/:repoId/context` with CLI token
- [x] 8.8 Wire all commands into `CliModule`, set up `bin/fabrick` entry point
- [x] 8.9 Add `npm run build` script (`tsc`), verify `fabrick --help` works after build
