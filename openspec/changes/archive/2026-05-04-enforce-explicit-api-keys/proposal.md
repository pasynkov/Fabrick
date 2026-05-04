## Why

The system currently has a fallback mechanism that uses environment variables for Anthropic API keys when no key is explicitly configured in the organization or project settings. This masks configuration errors and prevents proper enforcement of the requirement that users explicitly provide API keys. Additionally, API key management is currently split across separate edit forms and detail pages, creating a fragmented user experience.

## What Changes

- **API key management consolidated**: Organization and project edit forms are renamed to "Settings" and now include API key configuration alongside name editing
- **Explicit API key enforcement**: Backend fallback logic that uses `process.env.ANTHROPIC_API_KEY` is removed, making API key configuration mandatory for synthesis jobs **BREAKING**
- **UI disables synthesis when no API key**: The "Run Synthesis" button is disabled with a hint message when no API key is configured at org or project level

## Capabilities

### New Capabilities
- `org-settings-page`: Unified settings form for organizations that consolidates name and API key configuration, accessible only to organization admins
- `project-settings-page`: Unified settings form for projects that consolidates name and API key configuration, accessible only to organization admins
- `api-key-validation-on-save`: Validates API key format (prefix check) when settings form is saved
- `synthesis-button-api-key-check`: Disables synthesis button when no effective API key exists (project or org level)

### Modified Capabilities
- `org-management`: The organization edit form is merged into the settings page and now includes API key management
- `project-repo-management`: The project edit form is merged into the settings page and now includes API key management
- `fabrick-synthesis`: The synthesis job triggering now requires an explicit API key; environment variable fallback is removed

## Impact

- **Backend files affected**: SynthesisService, SynthesisProcessor (removal of environment variable fallback logic)
- **Frontend files affected**: EditOrgName.tsx, EditProjectName.tsx (will be replaced by OrgSettings and ProjectSettings), ProjectDetail.tsx, OrgDetail.tsx (router and navigation updates)
- **Breaking change**: Existing deployments relying on `ANTHROPIC_API_KEY` environment variable will break; users must explicitly configure API keys in their organizations or projects
- **User experience**: Clearer settings management, immediate visibility of missing API key configuration, and direct remediation path

Scope note: `synthesis-error-messaging` extracted to separate proposal — see branch `proposal/63-synthesis-error-messaging`
