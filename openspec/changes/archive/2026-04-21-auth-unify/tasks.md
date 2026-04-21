## 1. New FabrickAuthGuard

- [x] 1.1 Create `auth/fabrick-auth.guard.ts` — strip `fbrk_` prefix, `jwtService.verify()`, populate `request.user` with `{ id, email, type, org?, project?, repo? }`
- [x] 1.2 Export `FabrickAuthGuard` from `AuthModule`
- [x] 1.3 Replace all `@UseGuards(AnyAuthGuard)` and `@UseGuards(CliTokenGuard)` usages across controllers with `@UseGuards(FabrickAuthGuard)`
- [x] 1.4 Delete `any-auth.guard.ts` and `cli-token.guard.ts`

## 2. CLI token → JWT

- [x] 2.1 In `AuthService.issueCliToken()`: remove random hex + sha256 + DB write; return `fbrk_` + `jwtService.sign({ sub, email, type: "cli" }, { expiresIn: "1y" })`
- [x] 2.2 Delete `CliToken` entity (`cli-token.entity.ts`)
- [x] 2.3 Create TypeORM migration: `DROP TABLE cli_tokens`
- [x] 2.4 Remove `CliToken` from `TypeOrmModule.forFeature([...])`  in `AuthModule`

## 3. MCP token endpoint

- [x] 3.1 Add `POST /auth/mcp-token` to `AuthController`: accepts `{ orgSlug, projectSlug, repoId }`, requires valid JWT auth, returns `{ token: "fbrk_<jwt>" }` with `type: "mcp"` claims
- [x] 3.2 Add `issueMcpToken(userId, orgSlug, projectSlug, repoId)` to `AuthService`
- [x] 3.3 Validate that user is a member of the given org before issuing token

## 4. CLI updates

- [x] 4.1 In `login.command.ts`: update stored token field — credentials now contain `fbrk_<jwt>` from `/auth/cli-token`
- [x] 4.2 In `init.command.ts`: after project/repo selection, call `POST /auth/mcp-token`, write resulting token to `.mcp.json` (replace current hardcoded Bearer token field)
- [x] 4.3 Verify existing `ApiService` sends `Authorization: Bearer <token>` unchanged (no format change needed)

## 5. Cleanup

- [x] 5.1 Remove `MinioService` import from `AuthModule` if it was only used for bucket creation during register (keep bucket creation, just inline it or move to `OrgsService`)
- [x] 5.2 Update `AuthModule` imports: remove `TypeOrmModule.forFeature([CliToken])`
- [x] 5.3 Confirm all tests pass; update any unit tests that mock `CliTokenRepo`
