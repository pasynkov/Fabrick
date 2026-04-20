---
name: fabrick-search
description: Answer architectural questions by navigating the synthesized architecture/ folder. Reads index.md first to identify relevant files, then reads only those. Run in a directory that contains an architecture/ folder produced by fabrick-synthesis.
---

Answer the user's question about the system architecture using the `architecture/` folder. Navigate intelligently — read the minimum files needed, not everything.

**CRITICAL CONSTRAINT: You MUST NOT read all files in architecture/. Read index.md first, then read ONLY the 1-2 files it points you to. Reading every file defeats the purpose of this skill.**

---

## Step 1: Read the Index (ALWAYS FIRST)

Read `architecture/index.md`.

```
Read: architecture/index.md
```

Do not read any other file yet. Study the navigation guide in index.md to understand which files answer which types of questions.

If `architecture/index.md` does not exist, stop and report:
> Error: `architecture/index.md` not found. Run `fabrick-synthesis` first to generate the architecture folder.

---

## Step 2: Identify Relevant Files (1-2 files only)

Based on the user's question and the navigation guide in index.md, identify which 1-2 files to read:

- Question about a specific app's behavior, endpoints, or flows → read `architecture/apps/{repo}.md`
- Question about env vars → read `architecture/cross-cutting/envs.md`
- Question about which app calls which → read `architecture/cross-cutting/integrations.md`
- Question about what the whole system does → read `architecture/overview.md`
- Question spans an app AND its env vars → read `architecture/apps/{repo}.md` (env vars are included there too)

**Maximum: 2 files beyond index.md. If unsure, pick the most specific one.**

---

## Step 3: Read Selected Files

Read only the file(s) identified in Step 2.

---

## Step 4: Answer

Answer the user's question concisely and accurately based on what you read. Structure the answer to directly address what was asked.

At the end of your answer, cite your sources:

> **Sources:** `architecture/index.md`, `architecture/apps/{repo}.md`

Do not pad the answer. Do not summarize files you didn't read. Do not speculate beyond what the files contain.

---

## Examples

**Q: "Which app handles context uploads? What are its envs?"**
→ Read: `architecture/index.md` → identifies `apps/fabrick-api.md` → read that one file → answer with app purpose + env table

**Q: "What env vars does the system use across all apps?"**
→ Read: `architecture/index.md` → identifies `cross-cutting/envs.md` → read that one file → answer with grouped env table

**Q: "How does the frontend get data from the backend?"**
→ Read: `architecture/index.md` → identifies `cross-cutting/integrations.md` → read that → answer with call chain

**Q: "What does this whole system do?"**
→ Read: `architecture/index.md` → identifies `overview.md` → read that → answer with system summary
