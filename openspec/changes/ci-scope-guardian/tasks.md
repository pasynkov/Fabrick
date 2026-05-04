## 1. Explore Dialogue Addon Flag (Preventive)

- [ ] 1.1 In `ci-proposal-explore.yml`, update the `Run explore dialogue` step prompt: add instruction "When you suggest a feature or capability not present in the original issue body, prefix it with `⚠️ ADDON (not in original request):` and recommend the user create a separate issue for it rather than including it in this proposal"

## 2. Scope Check Step (Reactive)

- [ ] 2.1 In `cd-proposal-create.yml`, after `Generate proposal artifacts` step, add step `Build scope check prompt` (Bash) that writes `/tmp/scope-check-prompt.txt` — instructions to read issue body from `${{ steps.thread.outputs.thread }}`, read generated change artifacts, identify addon capabilities (not traceable to issue body), and for each addon with ≥ 3 tasks: create separate change, generate artifacts, push branch, remove from original
- [ ] 2.2 Add step `Scope check — split addons` (`claude-code-base-action@beta`) after the prompt build step — model `claude-haiku-4-5-20251001`, allowed tools `Bash,Read,Write,Glob`, pass `GH_TOKEN` env var, `prompt_file: /tmp/scope-check-prompt.txt`
- [ ] 2.3 Ensure the scope-check prompt includes git constraints: configure git user before branch operations, return to original branch after each addon push (`git checkout -`), only push addon branches (not the original branch — that is handled by the existing commit-and-push step)
- [ ] 2.4 Ensure the scope-check prompt instructs Claude to update original `proposal.md` Impact section with a "Scope note" line for each split addon referencing its branch name

## 3. Verification

- [ ] 3.1 Manually test preventive flag: create a test issue, add `proposal` label, reply to trigger explore, verify AI marks suggestions not in issue body with `⚠️ ADDON`
- [ ] 3.2 Manually test reactive split: use issue #53 as reference case — verify that re-running `cd-proposal-create` on that issue thread would have detected audit-log as addon and created a separate `proposal/<issue>-audit-log` branch
