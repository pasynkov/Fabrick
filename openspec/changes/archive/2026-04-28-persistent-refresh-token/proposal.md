## Why

Users currently experience frequent re-authentication when using the Fabrick console due to refresh tokens being stored only in sessionStorage, which gets cleared when the browser session ends. This creates a poor user experience where users must log in every time they open a new browser session or restart their browser, even if they intended to stay logged in for longer periods.

The current implementation always provides refresh tokens but stores them insecurely in sessionStorage. We need a conditional persistent login feature that allows users to choose between session-based login (current behavior) and persistent login using secure storage mechanisms.

## What Changes

- Add a "Save Login" checkbox to both login and register forms in the console application
- Implement conditional refresh token storage based on checkbox state:
  - When unchecked (default): Store refresh tokens in sessionStorage (current behavior)
  - When checked: Store refresh tokens in secure httpOnly cookies for persistence
- Update authentication flow to detect and use existing persistent refresh tokens on application startup
- Ensure automatic token refresh works with both storage mechanisms
- Add token storage preference to user authentication context

## Capabilities

### New Capabilities
- `persistent-refresh-token-storage`: Secure httpOnly cookie storage for refresh tokens with conditional usage
- `login-persistence-choice`: UI components for user to choose between session and persistent login

### Modified Capabilities
- `console-token-refresh`: Enhance existing token refresh to work with both sessionStorage and httpOnly cookies
- `user-auth`: Update authentication service to handle conditional refresh token issuance and validation
- `console-app`: Modify login/register forms and auth context to support persistent login choice

## Impact

- Login and register forms will include a new "Save Login" checkbox (unchecked by default)
- Authentication endpoints will need to support conditional refresh token delivery via cookies
- Console application startup will check for existing persistent refresh tokens in cookies
- Token refresh mechanism will work seamlessly with both storage methods
- Users who check "Save Login" will remain authenticated across browser sessions
- No breaking changes to existing authentication flow when checkbox is unchecked
- Enhanced security through httpOnly cookies for persistent tokens (prevents XSS access)