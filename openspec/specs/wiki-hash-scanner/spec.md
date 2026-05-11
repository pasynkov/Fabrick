## ADDED Requirements

### Requirement: `fabrick scan` computes file content hashes and outputs diff

`fabrick scan [path]` SHALL walk files from `path` (default: cwd), compute SHA-256 hash of each file's content, compare with previous `.fabrick/wiki/hashmap.json` (if exists), and output a JSON diff to stdout. It SHALL respect `.gitignore` patterns, skip `node_modules/`, `.fabrick/`, `.git/`, `dist/`, `build/`, and common non-source directories.

The command has NO awareness of project structure (monorepo vs single app), NO LLM interaction, and does NOT write hashmap.json (that's `rebuild-source-map`'s job).

#### Scenario: First scan (no previous hashmap)
- **GIVEN** a directory with 50 source files and no `.fabrick/wiki/hashmap.json`
- **WHEN** `fabrick scan` runs
- **THEN** outputs `{ "mode": "full", "changed": [], "added": [all 50 paths], "deleted": [], "totalFiles": 50 }`

#### Scenario: Incremental scan detects changes
- **GIVEN** previous `hashmap.json` with 50 entries, 2 files modified, 1 added, 1 deleted
- **WHEN** `fabrick scan` runs
- **THEN** outputs `{ "mode": "incremental", "changed": [2 paths], "added": [1 path], "deleted": [1 path], "totalFiles": 50 }`

#### Scenario: Scanner skips non-source directories
- **GIVEN** a repo with `node_modules/`, `.git/`, `.fabrick/`, `dist/`
- **WHEN** `fabrick scan` runs
- **THEN** none of those directories' files appear in output

#### Scenario: --full flag forces full mode
- **GIVEN** previous `hashmap.json` exists
- **WHEN** `fabrick scan --full` runs
- **THEN** outputs mode "full" with all files in `added`, ignoring previous hashmap

### Requirement: `fabrick rebuild-source-map` rebuilds metadata after wiki generation

`fabrick rebuild-source-map [--wiki-path <path>]` SHALL read all `.md` files in the wiki directory (default: `.fabrick/wiki/`), parse YAML frontmatter to extract `sources` arrays, build an inverted source-map.json (source file → page slugs), re-scan source files for current hashes, and write both `source-map.json` and `hashmap.json` to the wiki directory.

#### Scenario: Source map reflects page sources
- **GIVEN** page `entities/user.md` has `sources: [src/models/user.ts, src/dto/user.dto.ts]`
- **AND** page `logic/auth-flow.md` has `sources: [src/models/user.ts, src/auth/auth.service.ts]`
- **WHEN** `fabrick rebuild-source-map` runs
- **THEN** `source-map.json` contains `{ "src/models/user.ts": ["entities/user", "logic/auth-flow"], "src/dto/user.dto.ts": ["entities/user"], "src/auth/auth.service.ts": ["logic/auth-flow"] }`

#### Scenario: Monorepo per-app rebuild
- **GIVEN** monorepo with app wiki at `apps/api/.fabrick/wiki/`
- **WHEN** `fabrick rebuild-source-map --wiki-path apps/api/.fabrick/wiki` runs
- **THEN** source-map.json and hashmap.json are written to `apps/api/.fabrick/wiki/`

### Requirement: Affected pages resolved by LLM using source-map.json

The LLM (in the skill session) SHALL read `source-map.json` and the scan output to determine which wiki pages need updating. This is NOT done by the CLI — the LLM has the context to make this judgment.

#### Scenario: LLM resolves affected pages
- **GIVEN** scan output shows `src/models/user.ts` changed
- **AND** LLM reads `source-map.json` mapping `src/models/user.ts` → `["entities/user", "logic/auth-flow"]`
- **WHEN** LLM decides what to update
- **THEN** LLM reads and updates `entities/user.md` and `logic/auth-flow.md`
