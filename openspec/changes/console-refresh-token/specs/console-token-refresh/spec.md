## ADDED Requirements

### Requirement: Automatic token refresh mechanism
The console application SHALL automatically refresh access tokens when they have less than 5 minutes remaining before expiration. It SHALL use a single refresh promise to prevent concurrent refresh attempts.

#### Scenario: Proactive token refresh
- **WHEN** the access token has less than 5 minutes until expiration
- **THEN** the console automatically calls the refresh endpoint and updates stored tokens

#### Scenario: Concurrent refresh prevention
- **WHEN** multiple API calls trigger refresh simultaneously
- **THEN** only one refresh request is made and all calls wait for the same refresh promise

### Requirement: Reactive token refresh on 401 responses
The console application SHALL attempt to refresh tokens when receiving 401 responses from API calls. If refresh succeeds, it SHALL retry the original request with the new access token.

#### Scenario: 401 triggers refresh and retry
- **WHEN** an API call returns 401 and a refresh token exists
- **THEN** the console refreshes tokens and retries the original request

#### Scenario: Refresh failure on 401
- **WHEN** an API call returns 401 and refresh token is invalid or expired
- **THEN** the console redirects the user to the login page

### Requirement: Secure token storage in frontend
The console application SHALL store refresh tokens in httpOnly cookies and access tokens in memory or sessionStorage. It SHALL never store refresh tokens in localStorage or accessible JavaScript storage.

#### Scenario: Token storage after login
- **WHEN** the user successfully logs in
- **THEN** the refresh token is stored in an httpOnly cookie and access token in sessionStorage

#### Scenario: Token cleanup on logout
- **WHEN** the user logs out
- **THEN** both httpOnly cookie and sessionStorage are cleared

### Requirement: Authentication state management
The console application SHALL maintain authentication state that tracks both access token validity and refresh token presence. It SHALL provide a loading state during token refresh operations.

#### Scenario: Authentication state during refresh
- **WHEN** a token refresh is in progress
- **THEN** the application shows a loading indicator and prevents additional refresh attempts

#### Scenario: Authentication state after refresh failure
- **WHEN** token refresh fails
- **THEN** the application clears all auth state and redirects to login

### Requirement: Grace period for token rotation
The console application SHALL implement a 30-second grace period where the old access token remains valid after refresh to handle race conditions with concurrent API requests.

#### Scenario: Concurrent request with old token during grace period
- **WHEN** an API request uses an old access token within 30 seconds of refresh
- **THEN** the server accepts the request and the console continues normally

#### Scenario: Old token usage after grace period
- **WHEN** an API request uses an old access token after the 30-second grace period
- **THEN** the server returns 401 and console triggers a new refresh cycle