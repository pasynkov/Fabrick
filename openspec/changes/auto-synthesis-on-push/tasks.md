## 1. Database Schema

- [ ] 1.1 Create auto_synthesis_config table with project_id, enabled columns
- [ ] 1.2 Create webhook_deliveries table for idempotency tracking with delivery_id and processed_at columns
- [ ] 1.3 Add database migration scripts for new tables
- [ ] 1.4 Update TypeORM entities for auto_synthesis_config and webhook_deliveries

## 2. GitHub Webhook Handler

- [ ] 2.1 Add webhook endpoint `/api/webhooks/github` to backend API
- [ ] 2.2 Implement webhook signature verification using HMAC-SHA256
- [ ] 2.3 Add webhook payload validation for required fields (repository, commits)
- [ ] 2.4 Implement idempotency handling using delivery_id tracking
- [ ] 2.5 Add error handling and security logging for invalid webhooks
- [ ] 2.6 Filter webhook events to process only push events

## 3. Auto-Synthesis Trigger Service

- [ ] 3.1 Create service to map GitHub repositories to Fabrick projects
- [ ] 3.2 Implement project auto-synthesis configuration lookup
- [ ] 3.3 Create synthesis job queueing with auto-trigger metadata

## 4. Enhanced Synthesis Job Queue

- [ ] 4.1 Extend queue message format to include trigger_source and commit details

## 5. Auto-Synthesis Configuration API

- [ ] 5.1 Create GET endpoint `/api/projects/{id}/auto-synthesis` for retrieving config
- [ ] 5.2 Create PUT endpoint `/api/projects/{id}/auto-synthesis` for updating config
- [ ] 5.3 Add validation for auto-synthesis configuration settings
- [ ] 5.4 Implement authorization checks for configuration management
- [ ] 5.5 Add default configuration creation for new projects

## 6. Synthesis Service Updates

- [ ] 6.1 Update synthesis service to handle auto-triggered job metadata
- [ ] 6.2 Add commit-specific context handling for auto-triggered jobs
- [ ] 6.4 Add trigger type tagging in synthesis output (auto vs manual)
- [ ] 6.5 Update synthesis service to preserve commit SHA information

## 7. Configuration and Deployment

- [ ] 7.1 Add GitHub webhook secret to environment configuration
- [ ] 7.2 Configure webhook URL in GitHub repository settings
- [ ] 7.3 Update deployment scripts for new database tables
- [ ] 7.5 Document auto-synthesis configuration options for users

## 8. fabrick push CLI Updates

- [ ] 8.1 Add synthesis prompt to `fabrick push` command when auto-synthesis is disabled
- [ ] 8.2 Pass synthesis flag to backend when user confirms synthesis prompt
- [ ] 8.3 Skip synthesis prompt when no API keys configured

## 9. Testing and Validation

- [ ] 9.1 Create unit tests for webhook handler functionality
- [ ] 9.2 Create unit tests for auto-synthesis trigger logic
- [ ] 9.3 Create integration tests for end-to-end auto-synthesis flow
- [ ] 9.4 Create tests for configuration API endpoints
- [ ] 9.5 Test webhook signature verification and security handling
- [ ] 9.6 Create tests for fabrick push synthesis prompt behavior
