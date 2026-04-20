## ADDED Requirements

### Requirement: Landing page deployable via swa CLI
The landing page SHALL be deployable to Azure SWA by running `npm run build` followed by `swa deploy` with the deployment token from Terraform output.

#### Scenario: Successful manual deploy
- **WHEN** developer runs `npm run build` then `swa deploy ./dist --deployment-token <token>`
- **THEN** the static files are uploaded to Azure SWA and `https://fabrick.me` serves the landing page

#### Scenario: Deployment token sourced from Terraform output
- **WHEN** developer runs the deploy command
- **THEN** the deployment token is retrieved via `terraform output -raw deployment_token` — no manual copy-paste of secrets required
