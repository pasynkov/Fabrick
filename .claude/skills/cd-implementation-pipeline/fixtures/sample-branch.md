# Sample branches for cd-implementation-pipeline

The orchestrator derives `<change-name>` from the branch name in CI:

```
BRANCH=${GITHUB_REF#refs/heads/}                # implementation/<full_name>
FULL_NAME=${BRANCH#implementation/}
NAME=$FULL_NAME

# Fallback: strip a leading numeric "<issue>-" prefix if the exact dir is not found.
if [ ! -d "openspec/changes/$NAME" ]; then
  NAME_NO_ID=$(echo "$NAME" | sed 's/^[0-9]*-//')
  if [ -d "openspec/changes/$NAME_NO_ID" ]; then
    NAME=$NAME_NO_ID
  fi
fi
```

## Branch → derived name table

| Branch | `openspec/changes/` dir | Derived `<change-name>` |
|---|---|---|
| `implementation/add-agentic-search` | `openspec/changes/add-agentic-search/` | `add-agentic-search` |
| `implementation/47-add-agentic-search` | `openspec/changes/add-agentic-search/` (no `47-...` dir) | `add-agentic-search` (leading issue id stripped) |
| `implementation/47-add-agentic-search` | `openspec/changes/47-add-agentic-search/` (exact match exists) | `47-add-agentic-search` (no strip) |
| `implementation/multi-agent-implementation-pipeline` | `openspec/changes/multi-agent-implementation-pipeline/` | `multi-agent-implementation-pipeline` |

The `<issue>` value used by step 0 (label) and step 6 (issue comment) is the leading numeric prefix of the **original** `<full_name>`, regardless of whether it was stripped from `<change-name>`:

```bash
ISSUE=$(echo "$FULL_NAME" | grep -oE '^[0-9]+' || true)
```

If `<full_name>` has no leading digits, `<ISSUE>` is empty and steps 0 and 7's label/comment operations are skipped.

## Local invocation

A developer drives the same pipeline locally by passing the resolved `<change-name>`:

```
/cd-implementation-pipeline <owner/repo> <change-name>
```

The orchestrator does not switch branches — the developer should already be on `implementation/<change-name>` (or whatever branch they want the doer commits to land on).
