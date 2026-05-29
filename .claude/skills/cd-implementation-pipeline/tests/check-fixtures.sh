#!/usr/bin/env bash
# Structural check for the cd-implementation-pipeline fixtures.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
FIXTURES="$REPO_ROOT/.claude/skills/cd-implementation-pipeline/fixtures"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# sample-branch.md
SAMPLE_BRANCH="$FIXTURES/sample-branch.md"
[ -f "$SAMPLE_BRANCH" ] || fail "sample-branch.md not found at $SAMPLE_BRANCH"
grep -qE 'implementation/' "$SAMPLE_BRANCH" \
  || fail "sample-branch.md must show at least one implementation/<name> branch"
grep -qiE '(issue[- ]id|leading [0-9]|^\| ?[0-9]+-|strip)' "$SAMPLE_BRANCH" \
  || fail "sample-branch.md must show a leading-issue-id stripping case"

# sample-change/
SAMPLE_CHANGE="$FIXTURES/sample-change"
[ -d "$SAMPLE_CHANGE" ] || fail "sample-change/ directory not found at $SAMPLE_CHANGE"
[ -f "$SAMPLE_CHANGE/proposal.md" ] || fail "sample-change/proposal.md missing"
[ -f "$SAMPLE_CHANGE/design.md" ]   || fail "sample-change/design.md missing"
[ -f "$SAMPLE_CHANGE/tasks.md" ]    || fail "sample-change/tasks.md missing"
[ -f "$SAMPLE_CHANGE/.openspec.yaml" ] || fail "sample-change/.openspec.yaml missing"

# At least one specs/<cap>/spec.md
if ! compgen -G "$SAMPLE_CHANGE/specs/*/spec.md" > /dev/null; then
  fail "sample-change/specs/<capability>/spec.md missing"
fi

echo "OK: fixtures structural checks pass"
