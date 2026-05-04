## Why

When synthesis jobs fail due to missing or invalid API keys, users receive generic error messages without clear guidance on how to resolve the issue. Synthesis errors related to API key problems should provide direct, actionable paths to fix the configuration.

## What Changes

- **Enhanced error detection**: Synthesis error handling identifies API key-related errors (missing or invalid)
- **Contextual error messages**: Error messages for API key failures include a direct link to the project settings form where users can add or update their API key
- **Consistent error format**: Uses a unified message format for both "missing API key" and "invalid API key" scenarios

## Capabilities

### New Capabilities
- `synthesis-error-messaging`: When synthesis fails due to API key issues, error messages include a direct link to the project settings form for remediation

## Impact

- **Frontend files affected**: ProjectDetail.tsx (error handling and display)
- **User experience**: Faster resolution of synthesis failures caused by API key configuration issues through direct navigation to settings
