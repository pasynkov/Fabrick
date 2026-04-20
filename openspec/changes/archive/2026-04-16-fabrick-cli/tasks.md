## 1. Package Scaffold

- [x] 1.1 Create `applications/cli/` directory with `package.json` (name: `fabrick`, bin: `fabrick`)
- [x] 1.2 Add dependencies: `commander`, `inquirer`, `archiver`, `yaml`
- [x] 1.3 Create `bin/fabrick.js` entrypoint that routes `init` and `push` subcommands
- [x] 1.4 Add `.gitignore` and `tsconfig.json` (if TypeScript) or set up plain JS with ESM

## 2. Config Module

- [x] 2.1 Create `src/config.js` — read/write `.fabrick/config.yaml` using `yaml` package
- [x] 2.2 Implement `readConfig()` — returns parsed config or throws with helpful message
- [x] 2.3 Implement `writeConfig({ project, repo, backendUrl })` — writes `.fabrick/config.yaml`

## 3. Init Command

- [x] 3.1 Create `src/commands/init.js`
- [x] 3.2 Implement AI tool selection prompt (single choice: Claude Code)
- [x] 3.3 Implement project name prompt with folder name as default
- [x] 3.4 Check for existing `.fabrick/config.yaml` and prompt overwrite if present
- [x] 3.5 Write config via config module
- [x] 3.6 Check for existing `.claude/skills/fabrick-analyze/SKILL.md` and prompt overwrite if present
- [x] 3.7 Copy embedded `fabrick-analyze` SKILL.md to `.claude/skills/fabrick-analyze/SKILL.md`
- [x] 3.8 Print next-step instructions after success

## 4. Embedded Skills

- [x] 4.1 Copy current `fabrick-analyze` SKILL.md into `src/skills/fabrick-analyze.md`
- [x] 4.2 Ensure file is included in npm package (check `files` field in `package.json`)

## 5. Push Command

- [x] 5.1 Create `src/commands/push.js`
- [x] 5.2 Read and validate config via config module
- [x] 5.3 Check `.fabrick/context/` exists and is non-empty
- [x] 5.4 Zip `.fabrick/context/` in-memory using `archiver`
- [x] 5.5 POST zip to `{backendUrl}/context/{repo}` as multipart/form-data with field `file`
- [x] 5.6 Handle HTTP 201 success — print repo, backend URL, confirmation
- [x] 5.7 Handle 4xx/5xx — print status + response body
- [x] 5.8 Handle connection error — print clear message with URL tried

## 6. Update fabrick-push Skill

- [x] 6.1 Rewrite `.claude/skills/fabrick-push/SKILL.md` to call `fabrick push` CLI
- [x] 6.2 Include install instructions for when CLI is not found

## 7. Verification

- [x] 7.1 Test `fabrick init` end-to-end in a scratch repo — verify config and skill files written
- [x] 7.2 Test `fabrick push` against local backend — verify 201 and context visible in MinIO
- [x] 7.3 Test `fabrick push` with missing context — verify error message
- [x] 7.4 Test `fabrick push` with missing config — verify error message
