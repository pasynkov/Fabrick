## 1. Prepare skills zip asset

- [x] 1.1 Create `claude-skills.zip` from `.claude/skills/fabrick-analyze/`, `fabrick-push/`, `fabrick-search/` (zip from project root so paths inside are `fabrick-analyze/...`)
- [x] 1.2 Place zip at `applications/backend/api/src/assets/claude-skills.zip`
- [x] 1.3 Update `applications/backend/api/nest-cli.json` to include `assets` entry copying `src/assets/**` to `dist/assets/`

## 2. Backend: skills endpoint

- [x] 2.1 Create `applications/backend/api/src/skills/skills.controller.ts` with `GET /skills/claude` — reads `dist/assets/claude-skills.zip`, sends with `Content-Type: application/zip`
- [x] 2.2 Create `applications/backend/api/src/skills/skills.module.ts` importing `AuthModule` and declaring the controller
- [x] 2.3 Register `SkillsModule` in `app.module.ts`

## 3. CLI: adm-zip dependency

- [x] 3.1 Add `adm-zip` to `applications/cli/package.json` dependencies
- [x] 3.2 Add `@types/adm-zip` to devDependencies

## 4. CLI: init command updates

- [x] 4.1 Add AI tool prompt to `init.command.ts` after repo registration — single select: `Claude`
- [x] 4.2 Download skills zip: `GET /skills/{aiTool}` using existing `ApiService`
- [x] 4.3 Extract zip entries: for each entry whose top-level dir starts with `fabrick-`, write to `.claude/skills/{path}`; skip all others
- [x] 4.4 Write `ai_tool` field to `.fabrick/config.yaml` alongside `repo_id` and `api_url`
- [x] 4.5 Log `✓ Installed Claude skills to .claude/skills/`

## 5. Rebuild and verify

- [x] 5.1 Build CLI: `npm run build` in `applications/cli/`
- [x] 5.2 Rebuild backend Docker image and confirm `dist/assets/claude-skills.zip` present
- [x] 5.3 Run `fabrick init` end-to-end — verify 3 skill dirs appear in `.claude/skills/`
