## 1. Create review-proposal skill

- [x] 1.1 Create `.claude/skills/review-proposal/SKILL.md`
- [x] 1.2 Skill accepts change name as argument
- [x] 1.3 Skill checks existence of proposal.md, design.md, tasks.md under `openspec/changes/<name>/`
- [x] 1.4 Pass: output success message
- [x] 1.5 Fail: list missing files + `Bash exit 1`

## 2. Create ci-proposal-review.yml

- [x] 2.1 Trigger: push to `proposal/**`
- [x] 2.2 Job `review`: extract name from branch, run `claude-code-action@v1` with skill prompt
- [x] 2.3 Use `CLAUDE_CODE_OAUTH_TOKEN`, model `claude-haiku-4-5-20251001`
- [x] 2.4 Job `promote`: `needs: [review]`, create `implementation/<name>`, delete `proposal/<name>`
- [x] 2.5 `promote` has `permissions: contents: write`

## 3. Test

- [ ] 3.1 Create `proposal/test-ai-review`, push with all 3 artifacts → verify review passes + branch renamed to `implementation/test-ai-review`
- [ ] 3.2 Create `proposal/test-ai-review-fail`, push without tasks.md → verify review fails, branch stays
