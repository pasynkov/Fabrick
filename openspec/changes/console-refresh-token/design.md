## Context

The current authentication system uses short-lived JWT access tokens (1 hour expiration) without refresh token support. Users must re-login frequently, which disrupts workflows and creates a poor user experience. The system needs to implement refresh token functionality to maintain security while providing seamless session extension.

Current authentication flow:
- Login returns only access token (1-hour expiry)
- No automatic session renewal
- Token expiration forces full re-authentication

## Goals / Non-Goals

**Goals:**
- Implement secure refresh token mechanism for extended sessions
- Automatic token renewal before expiration in the console
- Maintain security by using short-lived access tokens with longer-lived refresh tokens
- Graceful fallback to login when refresh fails

**Non-Goals:**
- Extending CLI token refresh (CLI tokens are already long-lived)
- Implementing remember-me functionality beyond refresh tokens
- Real-time token revocation across multiple sessions

## Decisions

### Decision 1: Refresh Token Storage Strategy
**Choice:** Issue refresh tokens as signed JWTs (stateless, no database storage)
**Rationale:** Real-time revocation across multiple sessions is explicitly out of scope (see Non-Goals). Stateless JWTs eliminate the need for a new database table while still supporting rotation — each `/auth/refresh` call issues a new JWT, making the old one practically obsolete. Separate secret from access tokens prevents cross-type forgery.
**Alternatives considered:**
- Dedicated DB table: Enables server-side revocation but adds schema migration and cleanup job complexity; revocation is out of scope anyway
- In-memory storage: Would not survive server restarts

### Decision 2: Token Rotation on Refresh
**Choice:** Issue new refresh token on each access token refresh (rotation)
**Rationale:** Limits exposure window if a refresh token is compromised and provides better security posture
**Alternatives considered:**
- Static refresh tokens: Higher security risk if compromised
- Optional rotation: Adds complexity without clear benefit

### Decision 3: Frontend Storage Strategy
**Choice:** Store refresh tokens in httpOnly cookies, access tokens in memory/sessionStorage
**Rationale:** Refresh tokens are more sensitive and benefit from XSS protection. Access tokens need to be accessible to JavaScript for API calls.
**Alternatives considered:**
- Both in localStorage: Vulnerable to XSS attacks
- Both in httpOnly cookies: Complex for SPA API authentication

### Decision 4: Refresh Timing Strategy
**Choice:** Automatic refresh when access token has <5 minutes remaining or on 401 response
**Rationale:** Proactive refresh prevents user experience disruption while reactive refresh handles edge cases
**Alternatives considered:**
- Only reactive refresh: Users may experience brief authentication failures
- Very early refresh: Unnecessary token churn

## Risks / Trade-offs

**Risk: Refresh token compromise** → Mitigation: Short expiration (7 days), rotation on use, secure storage
**Risk: Race conditions during concurrent refresh attempts** → Mitigation: Single refresh promise pattern, retry logic
**Risk: Token rotation breaking concurrent requests** → Mitigation: Grace period for old access tokens during rotation window
**Trade-off: Complexity vs security** → Stateless JWTs reduce implementation complexity with acceptable security posture given revocation is out of scope
**Trade-off: Stolen refresh token window** → If compromised, token lives until 7-day expiry; rotation limits this to single-use window