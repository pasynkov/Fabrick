## 1. Backend — Org Name Update

- [x] 1.1 Add `PATCH /orgs/:orgId` endpoint in `orgs.controller.ts`
- [x] 1.2 Implement `updateOrgName(orgId, name, userId)` in `orgs.service.ts` with admin check
- [x] 1.3 Add name validation (max 128 chars, non-empty)
- [x] 1.4 Log name change in `orgs.service.ts`
- [x] 1.5 Add E2E test for PATCH /orgs/:orgId

## 2. Backend — Project Name Update

- [x] 2.1 Add `PATCH /orgs/:orgId/projects/:projectId` endpoint in `repos.controller.ts`
- [x] 2.2 Implement `updateProjectName(orgId, projectId, name, userId)` in `repos.service.ts` with admin check
- [x] 2.3 Add name validation (max 128 chars, non-empty)
- [x] 2.4 Log name change in `repos.service.ts`
- [x] 2.5 Add E2E test for PATCH /orgs/:orgId/projects/:projectId

## 3. Frontend — API Client

- [x] 3.1 Add `updateOrg(orgId, name)` method to `api.ts`
- [x] 3.2 Add `updateProject(orgId, projectId, name)` method to `api.ts`

## 4. Frontend — Edit UI

- [x] 4.1 Create edit org name page/route in console
- [x] 4.2 Create edit project name page/route in console
- [x] 4.3 Add edit button visible to admins in `OrgList.tsx` and `OrgDetail.tsx`
- [x] 4.4 Add form validation (max 128 chars, non-empty) with error display
- [x] 4.5 Add loading state and error handling

## 5. Testing and Validation

- [x] 5.1 Verify non-admin cannot rename org or project (403 response)
- [x] 5.2 Verify slug does NOT change after rename
- [x] 5.3 Verify name change is logged
- [x] 5.4 Test frontend edit flow end-to-end
