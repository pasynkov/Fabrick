## Context

Two bugs reported by project admin:
1. No "Edit Settings" button on the project main page (unlike the Org main page).
2. Auto-synthesis toggle does not persist: toggled ON, user returns to settings page, toggle shows OFF.

Root cause for (2): ProjectSettings.tsx calls `api.projects.list()` which returns only `{ id, name, slug }` — it does not include `autoSynthesisEnabled`. The backend has a `getProjectSettings()` method that does return this field, but the frontend never calls it.

Current architecture: React frontend (ProjectSettings.tsx, ProjectDetail.tsx) communicating with NestJS backend (ReposController/ReposService) via REST.

## Goals / Non-Goals

**Goals:**
- Add "Edit Settings" button to ProjectDetail header for admin users
- Fix auto-synthesis toggle to load its state from the correct API endpoint

**Non-Goals:**
- Major architectural changes
- New features beyond what is described above
- Database schema modifications
- Authentication or authorization changes
- Validation refactoring, audit logging, or optimistic concurrency handling

## Decisions

### Decision 1: Fix Toggle Persistence via Dedicated Settings Endpoint
**What**: Create a frontend API method that calls the existing `getProjectSettings()` backend method; update ProjectSettings.tsx to use it instead of `projects.list()`
**Why**: The existing backend method already returns `autoSynthesisEnabled`; no backend changes needed
**Alternative considered**: Update `projects.list()` to include `autoSynthesisEnabled` → rejected to avoid changing the list endpoint contract

### Decision 2: "Edit Settings" Button in ProjectDetail Header
**What**: Add an admin-only "Edit Settings" link button to the ProjectDetail page header
**Why**: Matches the existing UX pattern from OrgDetail.tsx and makes settings discoverable
**Pattern**: Follow OrgDetail.tsx (lines 75-82) — admin role check, link to `/orgs/${orgSlug}/projects/${projectSlug}/settings`

## Risks / Trade-offs

**Risk**: Switching data source in ProjectSettings may reveal edge cases in the settings endpoint → **Mitigation**: The backend `getProjectSettings()` is already implemented and tested
