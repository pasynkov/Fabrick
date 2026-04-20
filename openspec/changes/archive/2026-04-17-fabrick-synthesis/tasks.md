## 1. Skill Scaffold

- [x] 1.1 Create `.claude/skills/fabrick-synthesis/SKILL.md`
- [x] 1.2 Write skill header: purpose, expected input structure, output structure

## 2. Input Discovery

- [x] 2.1 Skill reads all subdirectories of `downloaded/` and confirms each has `context/` inside
- [x] 2.2 Skill lists all context files per repo before synthesizing

## 3. Synthesis

- [x] 3.1 Create `architecture/` directory
- [x] 3.2 Write `architecture/overview.md` — high-level system description, how apps relate
- [x] 3.3 Write `architecture/apps/{repo}.md` for each repo — purpose, flows, envs, endpoints
- [x] 3.4 Write `architecture/cross-cutting/integrations.md` — inter-app calls and contracts
- [x] 3.5 Write `architecture/cross-cutting/envs.md` — all env vars across apps with descriptions

## 4. Navigation Index

- [x] 4.1 Write `architecture/index.md` last — after all other files exist
- [x] 4.2 index.md maps question types to specific files (e.g. "questions about auth → apps/backend.md")
- [x] 4.3 Verify index.md covers all generated files

## 5. Verification

- [x] 5.1 Run skill against 3 sample context folders
- [x] 5.2 Confirm `architecture/index.md` accurately points to the right files
- [x] 5.3 Confirm each `apps/{repo}.md` is self-contained (no cross-references needed to answer basic questions)
