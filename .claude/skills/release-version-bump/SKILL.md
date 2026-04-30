---
name: release-version-bump
description: Analyze archived OpenSpec change to determine semantic version bump (patch or minor)
type: skill
---

You are determining the semantic version bump for a software release.

## Instructions

1. List `openspec/changes/archive/` to find directories matching `<date>-<change-name>`.
   The change name is provided as an argument — find the directory whose suffix matches it.

2. Read the following files from the archive:
   - `proposal.md` — overall scope and intent
   - `design.md` — technical decisions and API changes
   - Any `specs/*.md` files — capability specifications

3. Analyze for breaking changes. Look for:
   - Removed or renamed API endpoints
   - Changed request/response schemas (removed fields, changed types)
   - Changed authentication or authorization requirements
   - Removed features or capabilities
   - Language like "breaking", "removed", "deprecated", "changed API", "incompatible", "no longer"

4. Output your decision:
   - Write `minor` to /tmp/version-bump.txt if breaking changes found
   - Write `patch` to /tmp/version-bump.txt if only additions or fixes
   - Write a single-line reason to /tmp/version-bump-reason.txt (e.g. "added user export endpoint" or "removed /v1/auth/token endpoint")

Default to `patch` when uncertain.
