## 1. Backend - Remove API Key Fallback Logic

- [x] 1.1 Remove try/catch fallback logic from SynthesisService (lines 50-57) that uses process.env.ANTHROPIC_API_KEY
- [x] 1.2 Remove defaultAnthropicApiKey property from SynthesisProcessor (line 48)
- [x] 1.3 Remove the fallback logic in SynthesisProcessor.processJob() that uses defaultAnthropicApiKey
- [x] 1.4 Ensure API key resolution errors propagate properly to trigger validation errors
- [x] 1.5 Test that synthesis fails with explicit error when no API key is configured

## 2. Frontend - Create Organization Settings Form

- [x] 2.1 Create OrgSettings.tsx component at src/pages/OrgSettings.tsx
- [x] 2.2 Add form fields for organization name and API key
- [x] 2.3 Implement admin-only access check (redirect non-admins)
- [x] 2.4 Integrate with existing organization update endpoints
- [x] 2.5 Implement API key format validation on form save
- [x] 2.6 Add form submission and error handling
- [x] 2.7 Test OrgSettings component with different permission levels

## 3. Frontend - Create Project Settings Form

- [x] 3.1 Create ProjectSettings.tsx component at src/pages/ProjectSettings.tsx
- [x] 3.2 Add form fields for project name and API key
- [x] 3.3 Implement admin-only access check (redirect non-admins)
- [x] 3.4 Integrate with existing project update endpoints
- [x] 3.5 Implement API key format validation on form save
- [x] 3.6 Add form submission and error handling
- [x] 3.7 Test ProjectSettings component with different permission levels

## 4. Frontend - Update Router and Navigation

- [x] 4.1 Add /settings routes to App.tsx router for organizations
- [x] 4.2 Add /settings routes to App.tsx router for projects
- [x] 4.3 Update organization detail page navigation link from "Edit Name" to "Edit Settings"
- [x] 4.4 Update project detail page navigation link from "Edit Name" to "Edit Settings"
- [x] 4.5 Remove or redirect old /edit routes for backwards compatibility
- [x] 4.6 Test that all navigation links point to correct settings pages

## 5. Frontend - Synthesis Button API Key Check

- [x] 5.1 Update ProjectDetail.tsx to check effective API key status
- [x] 5.2 Disable "Run Synthesis" button when no effective API key exists
- [x] 5.3 Add hint message text: "Add API key to enable synthesis"
- [x] 5.4 Make hint message a clickable link to project settings
- [x] 5.5 Test button state with various API key configurations (project-level, org-level, none)

## 6. Integration Testing

- [x] 6.1 Test full workflow: user without API key tries to run synthesis
- [x] 6.2 Verify synthesis button is disabled with link visible
- [x] 6.3 User clicks link, navigates to settings, adds API key
- [x] 6.4 Verify button becomes enabled after settings save
- [x] 6.5 Verify synthesis runs successfully with newly added API key
- [x] 6.6 Test that organization-level API key is used when project-level is not set
- [x] 6.7 Test that non-admin users cannot access settings pages

## 7. Cleanup and Migration

- [x] 7.1 Verify EditOrgName.tsx is no longer used (or remove if fully migrated)
- [x] 7.2 Verify EditProjectName.tsx is no longer used (or remove if fully migrated)
- [x] 7.3 Update any links or imports pointing to old edit components
- [x] 7.4 Verify no API calls still reference old edit endpoints
- [x] 7.5 Test backwards compatibility for old /edit URLs (redirect or error gracefully)
