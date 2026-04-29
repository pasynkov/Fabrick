## Why

Organizations and projects can be created but not renamed after creation. Admins need the ability to update names as requirements evolve.

## What Changes

- Add `PATCH /orgs/:orgId` endpoint to update organization name (admin-only)
- Add `PATCH /orgs/:orgId/projects/:projectId` endpoint to update project name (admin-only)
- Add edit UI in console — separate route for editing org/project names
- Log name changes

## Capabilities

### New Capabilities
- `org-name-update`: API endpoint and UI for renaming an organization
- `project-name-update`: API endpoint and UI for renaming a project within an org

### Modified Capabilities
- `org-management`: Extended with PATCH endpoint and admin guard
- `project-repo-management`: Extended with PATCH endpoint and admin guard
