## 1. Project Settings Update

- [ ] 1.1 Add `auto_synthesis_enabled` column to the existing projects table with migration
- [ ] 1.2 Add `autoSynthesisEnabled` field to the project DTO
- [ ] 1.3 Allow updating `autoSynthesisEnabled` via existing project settings endpoint (name and api key update)

## 2. fabrick push CLI Updates

- [ ] 2.1 Add synthesis trigger to `fabrick push` command when auto-synthesis is enabled
- [ ] 2.2 Add synthesis prompt to `fabrick push` command when auto-synthesis is disabled
- [ ] 2.3 Pass synthesis flag to backend when user confirms synthesis prompt
- [ ] 2.4 Skip synthesis prompt when no API keys configured

## 3. Configuration and Deployment

- [ ] 3.1 Update deployment scripts for updated projects table

## 4. Testing and Validation

- [ ] 4.1 Create unit tests for auto-synthesis trigger logic in CLI
- [ ] 4.2 Create integration tests for end-to-end auto-synthesis flow via push command
- [ ] 4.3 Create tests for project settings update with auto-synthesis flag
- [ ] 4.4 Create tests for fabrick push synthesis prompt behavior
