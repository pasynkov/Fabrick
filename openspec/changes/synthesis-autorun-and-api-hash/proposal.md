## Why

Auto-synthesis on context updates is a highly requested workflow improvement that eliminates the manual step of running synthesis after pushing code changes. Additionally, API key management in project/organization settings needs hash-based change detection to prevent accidental key loss during settings updates and provide better visibility into key status.

## What Changes

- Add "Run synthesis automatically on context update" toggle to project settings (defaults to false)
- Display API key hash in project and organization settings forms for immediate visibility
- Implement hash-based API key change detection to avoid unnecessary revalidation
- Update CLI push command to respect auto-synthesis setting when enabled
- Extend organization settings to support API key updates (synthesis toggle remains project-only)

## Capabilities

### New Capabilities
- `project-auto-synthesis-toggle`: Toggle control in project settings to enable/disable automatic synthesis on context updates
- `api-key-hash-display`: Display truncated API key hashes in settings forms for status visibility
- `hash-based-api-key-change-detection`: Compare API key hashes to detect actual changes and prevent unnecessary revalidation

### Modified Capabilities
- `project-settings`: Add auto-synthesis toggle field and hash display functionality
- `org-settings`: Add API key update capability with hash display (excluding synthesis toggle)

## Impact

- **Frontend**: ProjectSettings.tsx and OrgSettings.tsx components need new form fields and hash display logic
- **API Layer**: Project update endpoints already support autoSynthesisEnabled field; hash comparison logic exists in backend
- **CLI**: Push command already respects auto-synthesis setting and triggers synthesis when enabled
- **User Experience**: Streamlined workflow with automatic synthesis and safer API key management