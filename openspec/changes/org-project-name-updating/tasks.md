## 1. Backend — Org Name Update

- [ ] 1.1 Add `PATCH /orgs/:orgId` endpoint in `orgs.controller.ts`
- [ ] 1.2 Implement `updateOrgName(orgId, name, userId)` in `orgs.service.ts` with admin check
- [ ] 1.3 Add name validation (max 128 chars, non-empty)
- [ ] 1.4 Log name change in `orgs.service.ts`
- [ ] 1.5 Add E2E test for PATCH /orgs/:orgId

## 2. Backend — Project Name Update

- [ ] 2.1 Add `PATCH /orgs/:orgId/projects/:projectId` endpoint in `repos.controller.ts`
- [ ] 2.2 Implement `updateProjectName(orgId, projectId, name, userId)` in `repos.service.ts` with admin check
- [ ] 2.3 Add name validation (max 128 chars, non-empty)
- [ ] 2.4 Log name change in `repos.service.ts`
- [ ] 2.5 Add E2E test for PATCH /orgs/:orgId/projects/:projectId

## 3. Frontend — API Client

- [ ] 3.1 Add `updateOrg(orgId, name)` method to `api.ts`
- [ ] 3.2 Add `updateProject(orgId, projectId, name)` method to `api.ts`

## 4. Frontend — Edit UI

- [ ] 4.1 Create edit org name page/route in console
- [ ] 4.2 Create edit project name page/route in console
- [ ] 4.3 Add edit button visible to admins in `OrgList.tsx` and `OrgDetail.tsx`
- [ ] 4.4 Add form validation (max 128 chars, non-empty) with error display
- [ ] 4.5 Add loading state and error handling

## 5. Testing and Validation

- [ ] 5.1 Verify non-admin cannot rename org or project (403 response)
- [ ] 5.2 Verify slug does NOT change after rename
- [ ] 5.3 Verify name change is logged
- [ ] 5.4 Test frontend edit flow end-to-end
