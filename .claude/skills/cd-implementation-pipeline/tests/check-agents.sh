#!/usr/bin/env bash
# Structural check for cd-implementation-pipeline doer agent files.
# Verifies each agent under .claude/agents/ that this pipeline owns has:
#  - frontmatter `model:` line
#  - frontmatter `tools:` containing Bash, Read, Write, Edit, Skill
#  - body documenting the ERROR: failure convention
#  - body documenting a test-edit boundary (one of: free / forbidden / minor / no test edits)
#
# Usage: bash .claude/skills/cd-implementation-pipeline/tests/check-agents.sh
# Exit 0 on success, non-zero on first failure.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/.claude/agents"

DOER_AGENTS=(
  "change-applier.md"
  "simplifier.md"
  "reviewer.md"
  "build-fixer.md"
  "archiver.md"
)

REQUIRED_TOOLS=(Bash Read Write Edit Skill)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

for agent in "${DOER_AGENTS[@]}"; do
  path="$AGENTS_DIR/$agent"
  [ -f "$path" ] || fail "$agent: file not found at $path"

  frontmatter="$(awk 'BEGIN{i=0} /^---$/{i++; if(i==2)exit; next} i==1{print}' "$path")"
  body="$(awk 'BEGIN{i=0} /^---$/{i++; next} i>=2{print}' "$path")"

  echo "$frontmatter" | grep -qE '^model:[[:space:]]*' \
    || fail "$agent: missing frontmatter 'model:' line"

  echo "$frontmatter" | grep -qE '^tools:' \
    || fail "$agent: missing frontmatter 'tools:' line"

  tools_line="$(echo "$frontmatter" | grep -E '^tools:' | head -1)"
  for tool in "${REQUIRED_TOOLS[@]}"; do
    echo "$tools_line" | grep -q "$tool" \
      || fail "$agent: tools line missing required tool '$tool'"
  done

  echo "$body" | grep -qE '\bERROR:' \
    || fail "$agent: body must document the 'ERROR:' failure convention"

  echo "$body" | grep -qiE '(test[- ]edit|tests?[[:space:]]*(file|edit|boundary)|forbid.*test|may.*tests?|add.*tests?|modify.*tests?|no test edits|may not.*test)' \
    || fail "$agent: body must document a test-edit boundary"
done

echo "OK: ${#DOER_AGENTS[@]} doer agent files pass structural checks"
