## Context

The OpenSpec proposal pipeline has two phases where scope creep enters: explore (interactive dialogue) and propose (artifact generation). Addons introduced during explore end up fully specified in tasks.md, bloating every downstream AI step. The fix intercepts at both phases: preventively in explore, reactively in propose.

## Goals / Non-Goals

**Goals:**
- Flag AI-suggested features as addons during explore dialogue before user confirms
- Automatically split confirmed addons into separate proposal branches after artifact generation
- Keep the original change clean and focused on the original issue request

**Non-Goals:**
- Blocking the user from including addons (user can still choose to keep them)
- Changing the explore dialogue structure beyond adding the ADDON flag
- Modifying `ci-proposal-review.yml` (addon branches use it as-is)
- Splitting addons in the local `/openspec-propose` skill (CI only)

## Decisions

### Decision 1: Preventive flag is advisory, not blocking

The explore prompt update adds an `⚠️ ADDON` marker to AI suggestions not in the original issue body. The user can still say "yes, include it" — the flag is informational. The actual gate is the reactive split in cd-proposal-create.

**Why:** Can't block user in async GitHub issue dialogue. The reactive split is the reliable enforcement.

### Decision 2: Reactive split uses a dedicated AI step in cd-proposal-create

After `Generate proposal artifacts`, a new `claude-code-base-action` step runs the scope-check. It receives the issue body (already available via `steps.thread.outputs.thread`) and reads the generated artifacts.

```yaml
- name: Scope check — split addons
  uses: anthropics/claude-code-base-action@beta
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    model: claude-haiku-4-5-20251001
    allowed_tools: "Bash,Read,Write,Glob"
    prompt: |
      Issue thread: ${{ steps.thread.outputs.thread }}
      Change name: ${{ steps.name_step.outputs.name }}  # resolved after propose step
      Issue number: ${{ github.event.issue.number }}

      Read openspec/changes/<name>/proposal.md and tasks.md.
      Compare against original issue body.
      For each capability not traceable to the issue body:
        1. openspec new change "<addon-name>"
        2. Generate proposal.md, design.md, specs/, tasks.md for the addon
        3. git checkout -b proposal/<issue>-<addon-name>
        4. git add openspec/changes/<addon-name>/
        5. git commit -m "proposal: <addon-name>\n\nrefs #<issue>"
        6. git push origin proposal/<issue>-<addon-name>
        7. git checkout - (return to original branch)
        8. Remove addon capability from original change artifacts
      If no addons found: do nothing.
```

### Decision 3: Change name extraction timing

`cd-proposal-create.yml` currently writes change name to `/tmp/change-name.txt` inside the AI step. The scope-check step reads this file to know which change to inspect.

### Decision 4: Addon branch triggers review automatically

`ci-proposal-review.yml` fires on `push: branches: ['proposal/**']`. Pushing `proposal/<issue>-<addon-name>` auto-triggers it. No additional triggering needed.

### Decision 5: Original change references splits

After splitting, the scope-check step adds a note to the original `proposal.md` Impact section:
> "Scope note: `<addon-name>` extracted to separate proposal — see branch `proposal/<issue>-<addon-name>`"

## Risks / Trade-offs

- **False positive splits**: AI may misclassify a core feature as an addon if the issue body is ambiguous. Mitigation: the original PR still exists for human review; addons can be manually merged back if needed.
- **Git operations in AI step**: Pushing branches inside `claude-code-base-action` requires `GH_TOKEN` env var to be passed. Already done for the generate step — same pattern.
- **Addon artifact quality**: Addon proposals are generated quickly by Haiku from extracted context. Quality may be lower than a fully explored proposal. Mitigation: `ci-proposal-review.yml` runs on each addon branch and can fix discrepancies.
- **Empty addon changes**: If the extracted addon is trivial (1-2 tasks), creating a full change may be overkill. Mitigation: only split if addon has ≥ 3 tasks.
