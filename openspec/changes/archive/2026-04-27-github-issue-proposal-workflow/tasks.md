## 1. Labels Setup

- [x] 1.1 Create GitHub labels `proposal:exploring` and `proposal:ready` via `gh label create`

## 2. Explore Workflow

- [x] 2.1 Create `.github/workflows/ci-proposal-explore.yml` with triggers: `issues[labeled=proposal]` and `issue_comment[created]`
- [x] 2.2 Add concurrency group `proposal-explore-${{ github.event.issue.number }}` with `cancel-in-progress: true`
- [x] 2.3 Add bot filter: `if: github.actor != 'github-actions[bot]'` on comment trigger job
- [x] 2.4 Add step to fetch full issue thread: `gh issue view <N> --json title,body,comments`
- [x] 2.5 Add step `npm install -g @fission-ai/openspec` before `claude-code-base-action` step
- [x] 2.6 Wire `claude-code-base-action@beta` with prompt that passes thread text and invokes `/openspec-explore` skill
- [x] 2.7 Add step to apply `proposal:exploring` label on first trigger (labeled event only)

## 3. Proposal Create Workflow

- [x] 3.1 Create `.github/workflows/cd-proposal-create.yml` with trigger: `issues[labeled=proposal:ready]`
- [x] 3.2 Add step to fetch full issue thread: `gh issue view <N> --json title,body,comments`
- [x] 3.3 Add step `npm install -g @fission-ai/openspec` before `claude-code-base-action` step
- [x] 3.4 Wire `claude-code-base-action@beta` with prompt that passes thread and invokes `/openspec-propose`
- [x] 3.5 Add `contents: write` and `issues: write` permissions
- [x] 3.6 Add git config, branch create, commit with `refs #<issue-number>`, and push steps
- [x] 3.7 Add post-push comment on issue with branch name

## 4. Fix Existing Workflow

- [x] 4.1 Add `npm install -g @fission-ai/openspec` step to `.github/workflows/ci-proposal-review.yml` before the `claude-code-base-action` step

## 5. Verification

- [ ] 5.1 Create test issue with `proposal` label, verify explore comment posted and `proposal:exploring` added
- [ ] 5.2 Reply to bot comment, verify dialogue continues and bot reply does not loop
- [ ] 5.3 Add `proposal:ready` label, verify branch `proposal/<name>` created with correct commit message
- [ ] 5.4 Verify `ci-proposal-review` fires on pushed branch and completes successfully (openspec available)
