## Design Overview

### Error Detection Flow

1. **Error Handling Layer**: When synthesis fails, the error response from the backend is analyzed to determine if it's API key related
2. **Error Classification**: Errors are categorized as either:
   - Missing API key (resolution returned "none")
   - Invalid API key (validation or authorization errors)
3. **Message Enrichment**: Both error types receive the same remediation message with a direct link to settings

### Implementation Details

#### Error Message Format
```
"No API key configured. [Add API key](/orgs/:orgSlug/projects/:projectSlug/settings)"
```

#### Link Generation
- Extract `orgSlug` and `projectSlug` from current route or component state
- Build settings URL based on the organization and project context

#### Error Display
- Error messages are displayed in the existing error handling UI
- Link should be clickable and navigate directly to the project settings page

### Architecture Decisions

- **Detection**: Use error message content and error codes from backend to identify API key issues
- **Unified Format**: Single message format for both missing and invalid API key cases (as per issue requirements)
- **Non-intrusive**: Enhancement to existing error handling, no changes to success paths
