## 1. Backend API Authentication Updates

- [x] 1.1 Add JWT refresh token signing/verification using a separate secret (REFRESH_TOKEN_SECRET env var, 7d expiry)
- [x] 1.2 Update /auth/login endpoint to return both access_token and refresh_token
- [x] 1.3 Update /auth/register endpoint to return both access_token and refresh_token
- [x] 1.4 Implement POST /auth/refresh endpoint: verify refresh JWT, issue new access_token and refresh_token (rotation)
- [x] 1.5 Implement POST /auth/revoke endpoint (clears client-side cookie; no server state to remove)
- [x] 1.6 Add JWT-based refresh token validation guard for the refresh endpoint

## 2. Token Management and Security

- [x] 2.1 Implement 30-second grace period for old access tokens during rotation
- [x] 2.2 Add refresh token expiration (7 days) and access token validation

## 3. Console Frontend Authentication State

- [x] 3.1 Update authentication context to handle refresh tokens
- [x] 3.2 Implement secure storage: httpOnly cookies for refresh tokens, sessionStorage for access tokens
- [x] 3.3 Create token refresh service with automatic refresh logic
- [x] 3.4 Add authentication state management with loading states during refresh

## 4. Console Frontend Token Refresh Logic

- [x] 4.1 Implement proactive token refresh (when <5 minutes remaining)
- [x] 4.2 Implement reactive token refresh on 401 API responses
- [x] 4.3 Add single refresh promise pattern to prevent concurrent refresh attempts
- [x] 4.4 Implement retry logic for failed API calls after successful token refresh

## 5. Console Frontend Integration

- [x] 5.1 Update login page to handle refresh token storage
- [x] 5.2 Update register page to handle refresh token storage
- [x] 5.3 Update CLI auth flow to handle token refresh during the process
- [x] 5.4 Add logout functionality to clear both access and refresh tokens

## 6. Error Handling and Edge Cases

- [x] 6.1 Handle refresh token expiration with redirect to login
- [x] 6.2 Handle network failures during token refresh
- [x] 6.3 Add proper error messages for refresh token validation failures
- [x] 6.4 Implement fallback behavior when refresh fails

## 7. Testing and Validation

- [x] 7.1 Add unit tests for refresh token service methods
- [x] 7.2 Add integration tests for auth endpoints with refresh token flow
- [x] 7.3 Add frontend tests for automatic token refresh scenarios
- [x] 7.4 Test token rotation and old token grace period functionality
