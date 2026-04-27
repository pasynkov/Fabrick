## 1. Database Schema Setup

- [ ] 1.1 Create refresh_tokens table migration with id, user_id, token_hash, created_at, expires_at columns
- [ ] 1.2 Add foreign key constraint from refresh_tokens.user_id to users.id
- [ ] 1.3 Add index on refresh_tokens.token_hash for lookup performance
- [ ] 1.4 Add index on refresh_tokens.expires_at for cleanup queries

## 2. Backend API Authentication Updates

- [ ] 2.1 Create refresh token service with generate, validate, and revoke methods
- [ ] 2.2 Update /auth/login endpoint to return both access_token and refresh_token
- [ ] 2.3 Update /auth/register endpoint to return both access_token and refresh_token
- [ ] 2.4 Implement POST /auth/refresh endpoint with token rotation
- [ ] 2.5 Implement POST /auth/revoke endpoint for refresh token invalidation
- [ ] 2.6 Add refresh token validation middleware for the refresh endpoint

## 3. Token Management and Security

- [ ] 3.1 Implement SHA-256 hashing for refresh token storage
- [ ] 3.2 Add automatic cleanup job for expired refresh tokens
- [ ] 3.3 Implement 30-second grace period for old access tokens during rotation
- [ ] 3.4 Add refresh token expiration (7 days) and access token validation

## 4. Console Frontend Authentication State

- [ ] 4.1 Update authentication context to handle refresh tokens
- [ ] 4.2 Implement secure storage: httpOnly cookies for refresh tokens, sessionStorage for access tokens
- [ ] 4.3 Create token refresh service with automatic refresh logic
- [ ] 4.4 Add authentication state management with loading states during refresh

## 5. Console Frontend Token Refresh Logic

- [ ] 5.1 Implement proactive token refresh (when <5 minutes remaining)
- [ ] 5.2 Implement reactive token refresh on 401 API responses
- [ ] 5.3 Add single refresh promise pattern to prevent concurrent refresh attempts
- [ ] 5.4 Implement retry logic for failed API calls after successful token refresh

## 6. Console Frontend Integration

- [ ] 6.1 Update login page to handle refresh token storage
- [ ] 6.2 Update register page to handle refresh token storage
- [ ] 6.3 Update CLI auth flow to handle token refresh during the process
- [ ] 6.4 Add logout functionality to clear both access and refresh tokens

## 7. Error Handling and Edge Cases

- [ ] 7.1 Handle refresh token expiration with redirect to login
- [ ] 7.2 Handle network failures during token refresh
- [ ] 7.3 Add proper error messages for refresh token validation failures
- [ ] 7.4 Implement fallback behavior when refresh fails

## 8. Testing and Validation

- [ ] 8.1 Add unit tests for refresh token service methods
- [ ] 8.2 Add integration tests for auth endpoints with refresh token flow
- [ ] 8.3 Add frontend tests for automatic token refresh scenarios
- [ ] 8.4 Test token rotation and old token grace period functionality
- [ ] 8.5 Test cleanup job for expired refresh tokens