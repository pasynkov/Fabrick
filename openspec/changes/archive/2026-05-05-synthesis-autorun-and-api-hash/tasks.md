## 1. Project Settings Enhancement

- [x] 1.1 Add autoSynthesisEnabled field to project update API call in api.ts
- [x] 1.2 Create or enhance ProjectSettings component to include auto-synthesis toggle
- [x] 1.3 Add auto-synthesis toggle with clear labeling and help text to ProjectSettings form
- [x] 1.4 Implement hash display logic in ProjectSettings using existing ApiKeyStatusDisplay patterns
- [x] 1.5 Add hash-based change detection state management to ProjectSettings component

## 2. API Key Hash Display Implementation

- [x] 2.1 Enhance ProjectSettings to fetch and display API key hash on component mount
- [x] 2.2 Implement truncated hash display format ("...a1b2c3d4") in ProjectSettings
- [x] 2.3 Add appropriate status message when no API key is configured in ProjectSettings
- [x] 2.4 Ensure hash display updates immediately after API key changes in ProjectSettings

## 3. Hash-Based Change Detection

- [x] 3.1 Implement initial hash storage on ProjectSettings form load
- [x] 3.2 Add hash comparison logic to determine API key inclusion in update payload
- [x] 3.3 Ensure API key field is excluded from update when hash unchanged in ProjectSettings
- [x] 3.4 Test hash comparison prevents accidental key loss during other settings updates

## 4. Organization Settings Enhancement

- [x] 4.1 Create or enhance OrgSettings component for organization API key management
- [x] 4.2 Implement API key hash display in OrgSettings using same patterns as ProjectSettings
- [x] 4.3 Add hash-based change detection to OrgSettings component
- [x] 4.4 Ensure OrgSettings excludes auto-synthesis toggle (project-only feature)
- [x] 4.5 Test organization API key updates work correctly with hash-based change detection

## 5. Integration and Testing

- [x] 5.1 Test auto-synthesis toggle state persistence across page reloads
- [x] 5.2 Verify hash display works correctly for both project and organization settings
- [x] 5.3 Test hash-based change detection prevents unnecessary API key revalidation
- [x] 5.4 Ensure form submissions work correctly with hash comparison logic
- [x] 5.5 Test error handling for API key validation failures
