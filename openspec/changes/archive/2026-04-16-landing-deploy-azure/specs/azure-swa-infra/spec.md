## ADDED Requirements

### Requirement: Terraform provisions Azure Static Web App
The infrastructure SHALL be defined as Terraform code under `applications/landing/infrastructure/` and SHALL provision an Azure resource group and an Azure Static Web App on the free tier.

#### Scenario: Terraform apply creates SWA
- **WHEN** developer runs `terraform apply` in `applications/landing/infrastructure/`
- **THEN** an Azure resource group `fabrick-landing` and a Static Web App are created in the configured region

#### Scenario: Outputs expose deployment token and hostname
- **WHEN** `terraform apply` completes
- **THEN** `terraform output hostname` returns the SWA default hostname and `terraform output deployment_token` returns the deployment token (sensitive)

### Requirement: Terraform provisions custom domain for fabrick.me
The infrastructure SHALL bind the apex domain `fabrick.me` to the Azure Static Web App using `dns-txt-token` validation.

#### Scenario: Custom domain resource created after DNS validation
- **WHEN** developer has added TXT and ALIAS records to GoDaddy and runs `terraform apply`
- **THEN** `azurerm_static_web_app_custom_domain` resource is created and `fabrick.me` is bound to the SWA

#### Scenario: Validation token available before DNS setup
- **WHEN** developer runs first `terraform apply -target=azurerm_static_web_app.landing`
- **THEN** `terraform output validation_token` returns the TXT record value to add to GoDaddy
