Review an OpenSpec proposal against its source GitHub issue. Find discrepancies, fix them, report changes.

**Input**: `<change-name> [--issue <number>]`

---

## Steps

### 1. Parse arguments

Extract `<change-name>` and optional `--issue <number>` from args.

### 2. Verify artifacts exist

Check all required files under `openspec/changes/<name>/`:
- `proposal.md`
- `design.md`
- `tasks.md`
- at least one file under `specs/`

Use Read or Glob — not Bash. If any required file is missing, output the list of missing paths and exit 1.

### 3. If no issue number — stop here

Output: `✓ Proposal <name> artifacts present. No issue number provided — skipping consistency check.`

Exit normally.

### 4. Fetch issue thread

```bash
gh issue view <number> --json title,body,comments --repo "$GITHUB_REPOSITORY"
```

Parse the full conversation: initial request, AI analysis comments, author clarifications, confirmations.

**Focus on author's explicit decisions** — not AI-generated analysis. Specifically look for:
- Direct answers to questions ("Yes", "No", statements like "store in localStorage", "no DB changes")
- Confirmations of AI summaries (author accepts a bullet list = accepts those decisions)
- Explicit corrections ("No, use X instead of Y")

### 5. Read all artifacts

Read every file:
- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/tasks.md`
- `openspec/changes/<name>/specs/**/*.md`

### 6. Cross-reference issue vs. spec

For each explicit decision in the issue thread, check whether the spec matches it.

**Common discrepancy patterns:**

| What to check | How to detect |
|---|---|
| Storage decisions | Issue says "localStorage" but spec says "httpOnly cookie" |
| DB changes | Issue says "no DB changes" but spec defines a table |
| UX features | Issue mentions checkbox / flag, spec never mentions it |
| Conditional logic | Issue says "only if X" but spec makes it unconditional |
| Internal contradictions | design.md says stateless JWT, spec says DB table |
| Speculative additions | Feature in spec not traceable to any issue statement |

Build a list of discrepancies. For each:
- **What the issue says** (quote or paraphrase with location)
- **What the spec says** (quote with file + line)
- **Verdict**: conflict / missing / speculative addition / internal contradiction

### 7. Fix discrepancies

For each discrepancy, edit the relevant artifact(s) to align with the issue's explicit decisions.

Rules:
- Follow the author's explicit decisions. If they said "localStorage" — use localStorage.
- If there's an internal contradiction (design.md vs spec), resolve in favor of design.md Decision sections, unless the issue overrides it.
- If a feature is in the spec but not traceable to the issue and was not in the design — remove it.
- Do NOT remove things that are good practice and the issue doesn't contradict (e.g., error handling, retry logic).
- Preserve all other content. Surgical edits only.

Use the Edit tool for all changes.

### 8. Build report

Format the report as markdown:

```markdown
## Proposal Review: <name>

### Source Issue
#<number>: <title>

### Discrepancies Found & Fixed

#### 1. <Short title>
- **Issue says**: <quote or summary>
- **Spec had**: <what was wrong>
- **Fixed**: <what was changed and in which file>

#### 2. ...

### No Changes Needed
- <list of things that were already aligned>

### Speculative Additions Removed
- <list if any>
```

If no discrepancies found:
```markdown
## Proposal Review: <name>

### Result: ✓ Aligned with issue #<number>

All spec decisions trace back to explicit statements in the issue thread. No changes needed.
```

### 9. Write report to file

Write the full report to `/tmp/review-report.md` so the caller (CI or local tooling) can post it.

```bash
cat > /tmp/review-report.md << 'EOF'
<report content>
EOF
```

### 10. Output

Print the report to stdout. Exit 0 if review passed (with or without fixes). Exit 1 only if required artifacts are missing.
