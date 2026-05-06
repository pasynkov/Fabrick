## Why

Two issues were reported with the project frontend:
1. The project main page lacks an "Edit Settings" button (unlike the Org main page).
2. The "run synthesis automatically" toggle does not persist — turning it on and returning to the page shows it as off again.

## What Changes

- Add "Edit Settings" button to the project main page header (admin-only, matching Org page pattern)
- Fix auto-synthesis toggle persistence: ProjectSettings loads data from an endpoint that does not include `autoSynthesisEnabled`, causing the toggle to always appear off

## Capabilities

### Modified Capabilities
- `project-settings`: Fix toggle persistence and add header navigation button