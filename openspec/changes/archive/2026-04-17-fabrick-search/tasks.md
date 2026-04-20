## 1. Skill Scaffold

- [x] 1.1 Create `.claude/skills/fabrick-search/SKILL.md`
- [x] 1.2 Write skill header: purpose, expected input (architecture/ folder + question), how it navigates

## 2. Navigation Logic

- [x] 2.1 Skill instruction: always read `architecture/index.md` first
- [x] 2.2 Skill instruction: based on index.md, identify 1-2 relevant files only
- [x] 2.3 Skill instruction: explicitly forbidden from reading all files

## 3. Answer Generation

- [x] 3.1 Skill reads identified files and answers the question concisely
- [x] 3.2 Skill cites which file it used to answer (transparency)

## 4. DoD Verification

- [x] 4.1 Run skill with question: "Which app handles [X]? What are its envs and what do they do?"
- [x] 4.2 Verify answer is correct and references the right app
- [x] 4.3 Verify skill read at most index.md + 1 app file (not all files)
