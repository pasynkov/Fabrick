## 1. Database Schema

- [ ] 1.1 Create auto_synthesis_config table with project_id, enabled columns
- [ ] 1.2 Add database migration scripts for new table
- [ ] 1.3 Update TypeORM entities for auto_synthesis_config

## 2. Auto-Synthesis Configuration API

- [ ] 2.1 Create GET endpoint `/api/projects/{id}/auto-synthesis` for retrieving config
- [ ] 2.2 Create PUT endpoint `/api/projects/{id}/auto-synthesis` for updating config
- [ ] 2.3 Add validation for auto-synthesis configuration settings
- [ ] 2.4 Implement authorization checks for configuration management
- [ ] 2.5 Add default configuration creation for new projects

## 3. fabrick push CLI Updates

- [ ] 3.1 Add synthesis trigger to `fabrick push` command when auto-synthesis is enabled
- [ ] 3.2 Add synthesis prompt to `fabrick push` command when auto-synthesis is disabled
- [ ] 3.3 Pass synthesis flag to backend when user confirms synthesis prompt
- [ ] 3.4 Skip synthesis prompt when no API keys configured

## 4. Configuration and Deployment

- [ ] 4.1 Update deployment scripts for new database table
- [ ] 4.2 Document auto-synthesis configuration options for users

## 5. Testing and Validation

- [ ] 5.1 Create unit tests for auto-synthesis trigger logic in CLI
- [ ] 5.2 Create integration tests for end-to-end auto-synthesis flow via push command
- [ ] 5.3 Create tests for configuration API endpoints
- [ ] 5.4 Create tests for fabrick push synthesis prompt behavior
