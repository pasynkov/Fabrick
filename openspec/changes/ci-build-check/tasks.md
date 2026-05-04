## 1. Build Check Step

- [ ] 1.1 In `ci-implementation.yml`, add step `Build check` after `Commit review-fix` step with `id: build_check` and `continue-on-error: true` — runs `npm run build` for api, console (with `VITE_API_URL=https://placeholder`), and landing
- [ ] 1.2 Add step `Build fix prompt` (bash) after build check — generates `/tmp/build-fix-prompt.txt` with instructions to fix TypeScript/Vite compilation errors, constraints: no workflow files, no test files, no git commands
- [ ] 1.3 Add step `Fix build errors` (`claude-code-base-action@beta`) with `if: steps.build_check.outcome == 'failure'` — model `claude-sonnet-4-6`, allowed tools `Bash,Read,Write,Edit,Glob`, timeout 30 minutes, `prompt_file: /tmp/build-fix-prompt.txt`
- [ ] 1.4 Add step `Re-run builds after fix` with `if: steps.build_check.outcome == 'failure'` — same build commands as 1.1, this time without `continue-on-error` (must pass)
- [ ] 1.5 Add step `Commit build fixes` with `if: steps.build_check.outcome == 'failure'` — `git add -A`, commit `fix: build errors for <change-name>` only if staged changes exist
