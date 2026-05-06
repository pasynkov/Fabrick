## 1. Fix Auto-Synthesis Toggle Persistence

- [x] 1.1 Add a `getProjectSettings(orgSlug, projectSlug)` method to the frontend API client (api.ts) that calls the existing backend `getProjectSettings` endpoint
- [x] 1.2 Update ProjectSettings.tsx to fetch initial settings data using the new API method instead of `projects.list()`
- [x] 1.3 Verify the toggle state is correctly loaded from the response and pre-populated in the form

## 2. Add "Edit Settings" Button to Project Main Page

- [x] 2.1 Add an admin-only "Edit Settings" button to the ProjectDetail.tsx header, following the OrgDetail.tsx pattern
- [x] 2.2 Button links to `/orgs/${orgSlug}/projects/${projectSlug}/settings`
- [x] 2.3 Button is only visible when the current user has admin role

## 3. Verification

- [x] 3.1 Toggle turns ON, user navigates away and returns — toggle still shows ON
- [x] 3.2 "Edit Settings" button appears for admin users in ProjectDetail header
- [x] 3.3 "Edit Settings" button does not appear for non-admin users
