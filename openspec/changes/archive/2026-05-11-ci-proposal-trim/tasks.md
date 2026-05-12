## 1. Workflow: ci-proposal-trim.yml

- [ ] 1.1 Create `.github/workflows/ci-proposal-trim.yml`
- [ ] 1.2 Trigger: `pull_request_review_comment.created`
- [ ] 1.3 Guard: skip if branch does not match `proposal/**`
- [ ] 1.4 Guard: skip if `github.event.comment.author_association != 'OWNER'`
- [ ] 1.5 Parse branch name → extract `<name>` (strip `proposal/<issue_id>-` prefix)
- [ ] 1.6 Checkout repository on the proposal branch
- [ ] 1.7 Set concurrency group: `proposal-trim-${{ github.event.pull_request.head.ref }}`, `cancel-in-progress: false`

## 2. Claude Prompt

- [ ] 2.1 Build prompt with: `comment.body`, `comment.path`, `comment.diff_hunk`, change name
- [ ] 2.2 Instruct Claude to read `openspec/changes/<name>/**`
- [ ] 2.3 Instruct Claude to apply the comment as an edit (delete/rewrite/add as needed)
- [ ] 2.4 Instruct Claude to keep all other artifacts consistent (tasks.md, proposal.md, design.md)
- [ ] 2.5 Allowed tools: `Read`, `Edit`, `Write`, `Glob`, `Bash` (git only)

## 3. Commit & Push

- [ ] 3.1 Configure git identity (`github-actions[bot]`)
- [ ] 3.2 `git add openspec/changes/<name>/`
- [ ] 3.3 Commit only if changes staged: `fix(proposal): <comment summary> [review #<comment_id>]`
- [ ] 3.4 Push to proposal branch

## 4. Mark Comment Resolved

- [ ] 4.1 Add 👍 reaction to the review comment via GitHub API:
       `POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions`
       `{ "content": "+1" }`

## 5. Verification

- [ ] 5.1 Open a test PR on a `proposal/**` branch
- [ ] 5.2 Leave a review comment as OWNER → confirm workflow triggers
- [ ] 5.3 Verify Claude edits the correct `openspec/changes/<name>/` files
- [ ] 5.4 Verify commit pushed to proposal branch
- [ ] 5.5 Verify 👍 reaction added to comment
- [ ] 5.6 Leave two comments quickly → confirm second queues (not cancelled)
- [ ] 5.7 Leave a comment as non-OWNER → confirm workflow skips
