## Context

A fixture-only change. There is no real code surface; the design exists so the change tree validates and so dry-run scripts have something to read.

## Goals / Non-Goals

**Goals:**
- Provide a structurally valid `openspec/changes/<name>/` tree.

**Non-Goals:**
- Implement anything that survives outside the fixtures directory.

## Decisions

- Single capability `sample-capability` with one ADDED requirement and one scenario, kept minimal so fixture tests stay fast.

## Risks / Trade-offs

- None. This fixture's only risk is going stale relative to the real OpenSpec schema; fixture tests assert presence of required files but not deep schema conformance.
