## Why

The project settings functionality has accumulated technical debt through incremental additions, leading to inconsistent validation, error handling, and API patterns. Recent changes for auto-synthesis and API key management introduced edge cases and user experience issues that need systematic fixes.

## What Changes

- Standardize API key validation across frontend and backend
- Fix error handling and user feedback in the settings form  
- Improve API consistency for project updates
- Add proper input sanitization and validation
- Fix navigation issues after settings updates
- Enhance user experience with better loading states

## Capabilities

### New Capabilities
- `project-settings-validation`: Comprehensive input validation and error handling for project settings
- `project-settings-api-consistency`: Standardized API patterns for project updates and responses

### Modified Capabilities
- `project-settings`: Enhanced validation, error handling, and user experience improvements

## Impact

- Frontend: ProjectSettings.tsx component and related API calls
- Backend: ReposController and ReposService project update methods
- DTOs: UpdateProjectDto validation rules  
- User experience: Better error messages and form validation feedback