## Why

The console application currently uses JWT access tokens that expire in 1 hour, requiring users to re-login frequently. This creates a poor user experience, especially during longer work sessions. Users lose their work progress when tokens expire unexpectedly, and there's no graceful way to extend their session without full re-authentication.

## What Changes

- Add refresh token generation and validation to the authentication API
- Implement automatic token refresh in the console frontend when access tokens near expiration
- Add secure refresh token storage and rotation mechanisms
- Provide fallback to login page only when refresh tokens are invalid or expired

## Capabilities

### New Capabilities
- `token-refresh-api`: Server-side refresh token generation, validation, and rotation endpoints
- `console-token-refresh`: Frontend automatic token refresh mechanism with storage management

### Modified Capabilities
- `user-auth`: Extend authentication endpoints to include refresh token issuance and management
- `console-app`: Update authentication flow to handle refresh tokens and automatic session extension

## Impact

- API authentication endpoints (`/auth/login`, `/auth/register`) will return both access and refresh tokens
- Console application authentication state management will be enhanced with token refresh logic
- Database schema requires new `refresh_tokens` table for secure token storage
- All authenticated console sessions will benefit from extended session duration without re-login