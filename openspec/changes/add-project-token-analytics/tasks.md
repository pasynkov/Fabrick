## 1. Database schema

- [ ] 1.1 Add `TokenUsage` TypeORM entity with `id`, `projectId`, `operation`, `inputTokens`, `outputTokens`, `provider`, `createdAt`
- [ ] 1.2 Add a foreign key from `token_usage.project_id` to `projects.id` with `ON DELETE CASCADE`
- [ ] 1.3 Add a migration creating the `token_usage` table and the `(project_id, created_at DESC)` index
- [ ] 1.4 Run and verify the migration locally against PostgreSQL

## 2. Backend repository and service

- [ ] 2.1 Register `TokenUsage` in the relevant NestJS module
- [ ] 2.2 Add a repository/service method `recordUsage({ projectId, operation, inputTokens, outputTokens, provider })`
- [ ] 2.3 Add a service method `listForProject(projectId)` returning rows from the last 30 days ordered by `createdAt` DESC
- [ ] 2.4 Add unit tests covering insert and the 30-day list query

## 3. Search service integration

- [ ] 3.1 Capture `usage` from the slug-selection Anthropic response and call `recordUsage` with `operation = 'search'`
- [ ] 3.2 Capture `usage` from the answer-generation Anthropic response and call `recordUsage` with `operation = 'search'`
- [ ] 3.3 Wrap `recordUsage` calls so failures are logged but do not affect the search response
- [ ] 3.4 Add tests asserting both rows are written for a typical search request

## 4. Synthesis worker integration

- [ ] 4.1 Capture `usage` from each Anthropic response in the synthesis worker and call `recordUsage` with `operation = 'synthesis'` and the job's project id
- [ ] 4.2 Wrap `recordUsage` calls so failures are logged but do not abort the synthesis job
- [ ] 4.3 Add tests asserting one row per Claude call for a synthesis job

## 5. Analytics endpoint

- [ ] 5.1 Add controller route `GET /v1/projects/:id/token-analytics` guarded by existing JWT + project-access auth
- [ ] 5.2 Return JSON array of rows (`id`, `operation`, `inputTokens`, `outputTokens`, `provider`, `createdAt`)
- [ ] 5.3 Add integration tests for authorized success, unauthorized rejection, and empty-result cases

## 6. Console API client

- [ ] 6.1 Add `api.analytics.usage(projectId)` calling the new endpoint
- [ ] 6.2 Add TypeScript types matching the row schema

## 7. Console UI

- [ ] 7.1 Add an "Analytics" button on the project detail page near the existing project actions
- [ ] 7.2 Add a route and page component for the project analytics view
- [ ] 7.3 Render a table with columns: Date, Operation, Input Tokens, Output Tokens, Total, Provider
- [ ] 7.4 Render an empty state when the API returns no rows
- [ ] 7.5 Add component tests covering the empty state and a populated table

## 8. Verification

- [ ] 8.1 Run all backend and console tests
- [ ] 8.2 Manually verify that a search request inserts two rows and a synthesis job inserts one row per Claude call
- [ ] 8.3 Manually verify the analytics page renders the expected rows for a project
