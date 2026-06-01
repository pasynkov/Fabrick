# fabrick-analyze: Pattern Library

This file is read by the scanner agent before each analysis run. It contains learned extraction patterns discovered through the improvement loop — project-specific or framework-specific patterns that go beyond standard discovery.

**This file grows through `fabrick-analyze-loop`.** Do not edit manually unless adding a well-understood pattern.

## Format

Each entry follows this structure:

```markdown
## [Pattern Name]
**Trigger**: condition that indicates this pattern is present in the repo
**Action**: what to do when the trigger matches
**Example**: minimal code snippet showing the pattern
```

---

<!-- Patterns added by loop below this line -->
