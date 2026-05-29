#!/usr/bin/env bash
# Structural check for the cd-implementation-pipeline orchestrator SKILL.md.
# Verifies frontmatter and required sections.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SKILL="$REPO_ROOT/.claude/skills/cd-implementation-pipeline/SKILL.md"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[ -f "$SKILL" ] || fail "SKILL.md not found at $SKILL"

frontmatter="$(awk 'BEGIN{i=0} /^---$/{i++; if(i==2)exit; next} i==1{print}' "$SKILL")"
body="$(awk 'BEGIN{i=0} /^---$/{i++; next} i>=2{print}' "$SKILL")"

# Frontmatter
echo "$frontmatter" | grep -qE '^name:[[:space:]]*cd-implementation-pipeline' \
  || fail "frontmatter missing 'name: cd-implementation-pipeline'"
echo "$frontmatter" | grep -qE '^description:' \
  || fail "frontmatter missing 'description:'"
echo "$frontmatter" | grep -qE '^license:' \
  || fail "frontmatter missing 'license:'"
echo "$frontmatter" | grep -qE '^metadata:' \
  || fail "frontmatter missing 'metadata:' block"

# Unified argv signature documented in body
echo "$body" | grep -qE '/cd-implementation-pipeline[[:space:]]+<[^>]*repo[^>]*>[[:space:]]+<[^>]*(change-)?name[^>]*>' \
  || fail "body must document the unified argv: /cd-implementation-pipeline <repo> <change-name>"

# All seven step headings (Step 0..7)
for n in 0 1 2 3 4 5 6 7; do
  echo "$body" | grep -qE "^###[[:space:]]*Step[[:space:]]+${n}[[:space:]—-]" \
    || fail "body missing 'Step ${n}' heading"
done

# Doer-commit contract
echo "$body" | grep -qiE '(doer.*own.*commit|doer.*commit.*own|each doer.*commit|doer agents commit)' \
  || fail "body must document the doer-owns-its-commit contract"

# Per-step retry table / policy
echo "$body" | grep -qiE '(retry policy|per-step.*retry|retry budget|max(imum)? .*attempts? per step)' \
  || fail "body must describe the per-step retry policy"

# Build-attempt budget
echo "$body" | grep -qiE '(build.*(attempts|budget).*(3|three)|3 (build )?attempts|three build attempts)' \
  || fail "body must describe the build-attempt budget (3)"

# TDD-bounce policy with one-bounce cap
echo "$body" | grep -qiE 'TDD' \
  || fail "body must describe the TDD-bounce policy"
echo "$body" | grep -qiE '(one bounce|max(imum)? .*1 bounce|at most one bounce|single bounce)' \
  || fail "body must cap the TDD bounce at one"

echo "OK: SKILL.md structural checks pass"
