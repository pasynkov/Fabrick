#!/usr/bin/env bash
# Structural check for .github/workflows/cd-implementation.yml.
# Asserts the file is a thin wrapper invoking the orchestrator skill.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
NEW_WF="$REPO_ROOT/.github/workflows/cd-implementation.yml"
OLD_WF="$REPO_ROOT/.github/workflows/ci-implementation.yml"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[ -f "$NEW_WF" ] || fail "cd-implementation.yml not found at $NEW_WF"
[ ! -f "$OLD_WF" ] || fail "ci-implementation.yml still exists; rename was not completed"

# Triggers
grep -qE "branches:.*'implementation/\*\*'|branches:.*\"implementation/\*\*\"" "$NEW_WF" \
  || fail "cd-implementation.yml missing push trigger on implementation/**"
grep -qE 'workflow_dispatch' "$NEW_WF" \
  || fail "cd-implementation.yml missing workflow_dispatch trigger"

# Exactly one claude-code-base-action invocation
count=$(grep -cE 'anthropics/claude-code-base-action@beta' "$NEW_WF" || true)
[ "$count" -eq 1 ] \
  || fail "cd-implementation.yml must invoke claude-code-base-action@beta exactly once (found $count)"

# No inline stage steps masquerading as separate apply/simplify/review/build/archive/promote actions
if grep -qE '/tmp/apply-prompt\.txt|/tmp/simplify-prompt\.txt|/tmp/review-prompt\.txt|/tmp/review-fix-prompt\.txt|/tmp/build-fix-prompt\.txt|/tmp/archive-prompt\.txt' "$NEW_WF"; then
  fail "cd-implementation.yml must not build per-stage prompt files; the skill owns stage logic"
fi
if grep -qE '^\s*-\s+name:\s+(Apply OpenSpec change|Simplify changed files|Review changed files|Apply review fixes|Fix build failures|Archive OpenSpec change|Build all apps)' "$NEW_WF"; then
  fail "cd-implementation.yml must not contain per-stage steps (apply/simplify/review/build/archive)"
fi

# Promote job removed
if grep -qE '^\s*promote:\s*$' "$NEW_WF"; then
  fail "cd-implementation.yml must not contain a 'promote' job; promotion is pipeline step 6"
fi

# Skill invocation in prompt
grep -qE 'cd-implementation-pipeline' "$NEW_WF" \
  || fail "cd-implementation.yml prompt must reference the cd-implementation-pipeline skill"

# Credentials exposed
grep -qE 'GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}' "$NEW_WF" \
  || fail "cd-implementation.yml must expose GH_TOKEN to the action env"
grep -qE 'CLAUDE_CODE_OAUTH_TOKEN' "$NEW_WF" \
  || fail "cd-implementation.yml must expose CLAUDE_CODE_OAUTH_TOKEN"

echo "OK: cd-implementation.yml structural checks pass"
