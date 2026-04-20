## Context

This is the final verification step for the PoC. The search skill runs against a local `architecture/` folder produced by fabrick-synthesis. It must answer questions correctly without loading everything into context — that's the whole point.

## Goals / Non-Goals

**Goals:**
- Accept a natural language question
- Read `architecture/index.md` to decide which file(s) are relevant
- Read only those files
- Answer accurately and concisely

**Non-Goals:**
- Fuzzy search across all files
- Indexing or caching
- Multi-turn conversation (single Q&A per invocation)

## Decisions

### Two-step navigation
1. Read `architecture/index.md` → determine which file(s) to read
2. Read those file(s) → answer

This mirrors how a human would use a well-structured wiki: check the table of contents first, then go to the right section.

### Skill prompt structure
The skill instructs Claude to:
1. First, ONLY read `architecture/index.md`
2. Based on the question and the index, identify 1-2 files to read
3. Read those files
4. Answer the question

Explicitly forbidden: reading all files "just in case".

### Question examples the skill must handle
- "Which app handles user authentication?"
- "What does the DATABASE_URL env var do and which app uses it?"
- "What API does the frontend call for orders?"
- "What services does the devops repo deploy?"

## Risks / Trade-offs

- If synthesis produced a poor index.md → search quality degrades → fix in synthesis, not here
- Single-hop navigation only → complex cross-cutting questions may need 2 files → that's fine
