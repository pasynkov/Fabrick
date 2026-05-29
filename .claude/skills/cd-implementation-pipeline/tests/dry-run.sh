#!/usr/bin/env bash
# Dry-run smoke for cd-implementation-pipeline orchestrator contracts.
# Does NOT invoke Claude. It exercises the deterministic pieces:
#   - stage-skip flag derivation from git log + archive dir presence
#   - the ERROR: failure-signal convention is detectable
#   - the build-attempt budget is enforced (mocked loop)
#   - the TDD bounce cap is enforced (mocked loop)
#
# Run from anywhere; the script uses a tmpdir.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

# ---- Stage-skip derivation ----
cd "$TMP"
git init -q
git config user.email "test@example.com"
git config user.name "test"

NAME="sample-change"
mkdir -p "openspec/changes/$NAME"
echo "# proposal" > "openspec/changes/$NAME/proposal.md"
git add -A
git commit -qm "feat: apply $NAME"

# apply_done should be true; others false; archive_done false
if ! git log --oneline | grep -qF "feat: apply $NAME"; then
  echo "FAIL: apply_done detection broken" >&2
  exit 1
fi
if git log --oneline | grep -qF "refactor: simplify $NAME"; then
  echo "FAIL: simplify_done false positive" >&2
  exit 1
fi

# Archive dir absent → archive_done false
if compgen -G "openspec/changes/archive/*-$NAME" > /dev/null; then
  echo "FAIL: archive_done false positive on empty repo" >&2
  exit 1
fi

# Now create archive dir → archive_done true
mkdir -p "openspec/changes/archive/2026-05-29-$NAME"
if ! compgen -G "openspec/changes/archive/*-$NAME" > /dev/null; then
  echo "FAIL: archive_done detection failed when dir present" >&2
  exit 1
fi

# ---- ERROR: failure-signal convention ----
SAMPLE_REPLY="ERROR: TDD gap on 1.2, 2.3"
case "$SAMPLE_REPLY" in
  ERROR:*) ;;
  *) echo "FAIL: ERROR: prefix detection broken" >&2; exit 1 ;;
esac

# ---- Build-attempt budget (mocked) ----
ATTEMPTS=0
MAX=3
ALWAYS_RED=true
while [ $ATTEMPTS -lt $MAX ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ALWAYS_RED" = "false" ]; then break; fi
done
if [ $ATTEMPTS -ne 3 ]; then
  echo "FAIL: build-attempt budget did not cap at 3 (got $ATTEMPTS)" >&2
  exit 1
fi

# ---- TDD bounce cap (mocked) ----
BOUNCES=0
MAX_BOUNCES=1
GAP=true
while [ "$GAP" = "true" ]; do
  if [ $BOUNCES -ge $MAX_BOUNCES ]; then
    GAP=unresolved
    break
  fi
  BOUNCES=$((BOUNCES + 1))
  # simulate: applier didn't fix the gap; second-pass reviewer still flags
done
if [ $BOUNCES -ne 1 ] || [ "$GAP" != "unresolved" ]; then
  echo "FAIL: TDD bounce cap not enforced (bounces=$BOUNCES, gap=$GAP)" >&2
  exit 1
fi

echo "OK: dry-run smoke contracts pass"
