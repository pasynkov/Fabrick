## ADDED Requirements

### Requirement: Skill reads index.md first
The skill SHALL always start by reading `architecture/index.md` before reading any other file.

#### Scenario: Navigation starts from index
- **WHEN** user asks any question
- **THEN** skill reads `architecture/index.md` before opening any other file

### Requirement: Skill reads only relevant files
The skill SHALL read only the file(s) identified as relevant by index.md — not all files.

#### Scenario: Targeted file read for app question
- **WHEN** user asks "which app handles payments?"
- **THEN** skill reads `architecture/apps/{relevant-app}.md` only — not all app files

#### Scenario: Cross-cutting file read for env question
- **WHEN** user asks about a specific env variable
- **THEN** skill reads `architecture/cross-cutting/envs.md`

### Requirement: Answer is accurate and concise
The skill SHALL answer the question accurately based on what it read.

#### Scenario: DoD question answered correctly
- **WHEN** user asks "which app handles X, what are its envs and what do they do?"
- **THEN** skill provides the correct app name, lists its env vars, and explains each one

### Requirement: Skill does not load all architecture files
The skill SHALL NOT read every file in `architecture/` to answer a question.

#### Scenario: Minimal file reads
- **WHEN** skill answers a question
- **THEN** it reads at most 2-3 files (index.md + 1-2 relevant files)
