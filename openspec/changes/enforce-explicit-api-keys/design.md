## Context

The system currently has API key management scattered across multiple UI locations: organization and project edit forms (name-only) with separate detail pages (ApiKeySection, ProjectKeyResolutionChain) that handle API keys. Additionally, the backend fallback mechanism using `process.env.ANTHROPIC_API_KEY` allows the system to mask missing API key configuration, creating silent failures or unexpectedly using environment variable keys instead of explicitly configured ones.

**Current State:**
- API keys stored encrypted in Organization and Project entities
- ApiKeyResolutionService implements hierarchical resolution (project → org → error)
- Edit forms only handle names; API key management is separate
- SynthesisService and SynthesisProcessor have fallback logic to environment variable
- No UI indication of whether synthesis can run (no API key check on button)
- API key validation service exists and checks `sk-ant-` prefix format

**Stakeholder Requirements:**
- Settings pages should be catch-all for future extensibility (not just name + API key)
- Admin-only access to settings pages
- API key validation on form save (prefix check only)
- Immediate enforcement of explicit API key requirement (no migration period)
- Error messages should include direct link to settings form
- Legacy projects should explicitly fail if no API key configured

## Goals / Non-Goals

**Goals:**
- Consolidate API key management into unified settings forms (one per org, one per project)
- Remove environment variable fallback logic from backend
- Disable synthesis button when no effective API key exists
- Include direct remediation links in error messages
- Establish settings forms as extensible for future org/project configuration needs

**Non-Goals:**
- Implement API key rotation or versioning
- Add API key scoping or granular permissions
- Create API key usage rate limiting at the form level
- Change the encryption or storage mechanism for API keys
- Modify the hierarchical resolution logic itself

## Decisions

**Decision 1: Form Consolidation Strategy**
- Create new `OrgSettings.tsx` component at `/orgs/:orgSlug/settings`
- Create new `ProjectSettings.tsx` component at `/orgs/:orgSlug/projects/:projectSlug/settings`
- Both forms include name and API key fields in a single form
- Old edit routes (`/orgs/:orgSlug/edit` and `/orgs/:orgSlug/projects/:projectSlug/edit`) redirect or are removed
- **Rationale**: Unified settings page accommodates future configuration needs (webhooks, notification preferences, etc.). Single form with both fields reduces complexity and data fetching. Scope confirmed by stakeholder as catch-all for future extensibility.
- **Alternative considered**: Keep separate forms for name and API key with modal/drawer UX - rejected because stakeholder wants unified settings page.

**Decision 2: Admin-Only Access Enforcement**
- Settings pages check `orgInfo.role === 'admin'` before rendering
- Non-admin users see permission denied or redirect to project/org detail page
- Uses existing permission checking pattern from org management
- **Rationale**: Aligns with existing API key management permission model and reduces security surface. Stakeholder confirmed admin-only is expected behavior.

**Decision 3: Form Validation Timing**
- On form save, call existing `ApiKeyValidationService` to validate format
- Validation checks `sk-ant-` prefix only (per stakeholder requirement)
- No test of key liveness at form save time (backend will validate at synthesis trigger)
- **Rationale**: Lightweight client-side validation provides immediate feedback. Backend validation at synthesis trigger time is the source of truth for key viability. Separating concerns reduces form submission latency.

**Decision 4: Backend Enforcement - Remove Fallback Logic**
- In `SynthesisService.ts` (lines 50-57): Remove try/catch fallback to `process.env.ANTHROPIC_API_KEY`
- In `SynthesisProcessor.ts`: Remove `defaultAnthropicApiKey` property and fallback logic
- Let resolution errors propagate naturally; synthesis will fail with clear error if no key exists
- **Rationale**: Forces explicit configuration and prevents silent failures. Breaking change is intentional per stakeholder.
- **Alternative considered**: Add config flag to enable/disable fallback - rejected because stakeholder wants immediate enforcement.

**Decision 5: Button State Management**
- Check `ProjectKeyResolutionChain.effectiveSource === 'none'` in ProjectDetail
- Disable "Run Synthesis" button if no effective API key
- Show hint text: "Add API key to enable synthesis"
- Hint links to `/orgs/:orgSlug/projects/:projectSlug/settings`
- **Rationale**: Visual feedback before user attempts to trigger synthesis. Reuses existing resolution logic. Direct link provides clear next action.

**Decision 6: Error Messaging**
- When synthesis fails with API key error, include `<a href="/orgs/:orgSlug/projects/:projectSlug/settings">Add API key</a>` in error message
- Use one message format for both "not set" and "invalid" API key scenarios
- Backend error handler detects API key-related errors and enriches with settings link
- **Rationale**: Consistent messaging reduces confusion. Direct link enables self-service remediation. Stakeholder confirmed unified message acceptable.

## Risks / Trade-offs

**Risk 1: Breaking Change Impact**
- [Risk] Existing deployments relying on ANTHROPIC_API_KEY env var will break immediately
- [Mitigation] Change is deployed as breaking change. Stakeholder confirmed no migration period needed. Clear error messages guide users to settings form.

**Risk 2: Form Complexity Growth**
- [Risk] Settings form designed as catch-all will accumulate features over time, reducing clarity
- [Mitigation] Establish form field organization discipline (group related fields, use collapsible sections if needed). Document settings form architecture for future changes.

**Risk 3: Resolution Cache Invalidation**
- [Risk] If ProjectKeyResolutionChain or ApiKeyResolutionService caches results, button state may be stale after settings update
- [Mitigation] Verify caching behavior; if caching exists, ensure form submission invalidates cache before redirecting.

**Risk 4: API Key Input Security**
- [Risk] Form inputs raw API key values, creating exposure in browser memory/network
- [Mitigation] Use HTTPS only (already enforced). Consider masking key display (e.g., show first 8 and last 4 chars). Don't log keys in debug. Follow existing ApiKeySection pattern for input masking.

**Risk 5: Admin-Only Settings Access**
- [Risk] Non-admin team members cannot update API keys if it becomes stale or needs rotation
- [Mitigation] Acceptable per stakeholder. Future work could implement granular permissions. Current design prioritizes simplicity.

## Risks / Trade-offs

## Migration Plan

**Deployment Steps:**
1. Deploy backend changes (removal of fallback logic) to staging environment
2. Test that synthesis fails properly without API key configured
3. Deploy frontend changes (settings forms + button state logic)
4. Update routes in App.tsx to add `/settings` routes
5. Update navigation links to point to settings instead of edit
6. Monitor for users hitting API key missing errors
7. Provide documentation/guidance if needed

**Rollback Strategy:**
- Revert backend fallback logic removal if significant user impact detected
- Frontend can be rolled back independently without data loss
- No database changes required, so rollback is straightforward

**Timeline:**
- Backend changes first (establish enforcement)
- Frontend follows within same deployment cycle
- No phased rollout needed; changes are interdependent

## Open Questions

1. **API endpoint surface**: Confirm current API endpoints for updating org name and API key. Are they separate (`PATCH /orgs/:id/name`, `PATCH /orgs/:id/apiKey`) or unified (`PATCH /orgs/:id`)?
2. **Navigation flow**: After settings form save, should user redirect back to project/org detail or stay on settings?
3. **Settings URL naming**: Is `/settings` the final URL pattern or should it be more specific (e.g., `/configure`, `/admin`)?
4. **Future extensibility**: Are there other org/project settings planned soon? (Influences form design)
