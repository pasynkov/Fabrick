## Context

The Fabrick console only supports creating orgs and projects. Once created, names cannot be changed. The API has no PATCH/PUT endpoints for orgs or projects. The frontend shows names as read-only.

Slugs are generated from names and used as immutable identifiers in blob storage paths (`${orgSlug}/${projectSlug}/`). Slugs must NOT change when names are updated.

## Goals / Non-Goals

**Goals:**
- Allow org admins to rename their organization
- Allow org admins to rename projects within their org
- Separate edit route/page in the console UI
- Log name changes (not full audit trail)
- Validate name length (max 128 chars)

**Non-Goals:**
- Slug regeneration on rename — slugs are immutable
- Inline editing — separate route only
- Audit trail / change history
- Non-admin members renaming orgs or projects
- Reserved names list

## Decisions

### Permissions: Admin-Only
**Decision**: Only org admins can rename orgs and projects.
**Rationale**: Owner confirmed "organisation admins has ability to rename orgs and projects."

### Slugs: Immutable
**Decision**: Slugs are NOT regenerated when names change.
**Rationale**: "we use slugs for blob storage catalog" — changing slugs would break storage paths and CLI references.

### UI Pattern: Separate Route
**Decision**: Edit functionality lives on a separate route/page, not inline.
**Rationale**: Owner confirmed "separate route. later we will add some functionality to there."

### Name Validation: 128 Char Limit
**Decision**: Max 128 characters for org and project names.
**Rationale**: "check database constraints, if there no limitations leave 128 symbols."

### Logging: Name Changes Logged
**Decision**: Log name changes but no formal audit trail.
**Rationale**: Owner confirmed "names changes should be logged but not audited."

## Risks / Trade-offs

**Risk**: Slug/name divergence confuses users → **Mitigation**: Show slug separately in UI, document it's immutable
**Risk**: CLI compatibility → No risk: CLI uses orgId/projectId, not slugs
