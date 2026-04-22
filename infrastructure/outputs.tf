output "api_default_hostname" {
  description = "Function App default hostname (before custom domain)"
  value       = "https://${azurerm_linux_function_app.api.default_hostname}"
}

output "api_custom_domain" {
  value = "https://api.fabrick.me"
}

output "console_default_hostname" {
  description = "Static Web App default hostname (before custom domain)"
  value       = "https://${azurerm_static_web_app.console.default_host_name}"
}

output "console_custom_domain" {
  value = "https://console.fabrick.me"
}

output "landing_default_hostname" {
  description = "Existing landing Static Web App"
  value       = "https://${data.azurerm_static_web_app.landing.default_host_name}"
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

output "console_deploy_token" {
  description = "API token for Static Web Apps GitHub Actions deploy"
  value       = azurerm_static_web_app.console.api_key
  sensitive   = true
}

output "github_deploy_azure_credentials" {
  description = "Value for AZURE_CREDENTIALS GitHub Actions secret"
  sensitive   = true
  value = jsonencode({
    clientId       = azuread_application.github_deploy.client_id
    clientSecret   = azuread_service_principal_password.github_deploy.value
    subscriptionId = var.subscription_id
    tenantId       = data.azurerm_client_config.current.tenant_id
  })
}

output "github_deploy_registry_login_server" {
  description = "Value for REGISTRY_LOGIN_SERVER GitHub Actions secret"
  value       = azurerm_container_registry.main.login_server
}

output "app_insights_connection_string" {
  description = "Application Insights connection string for the API"
  value       = azurerm_application_insights.api.connection_string
  sensitive   = true
}

output "dns_records_required" {
  description = "DNS records to create before custom domains activate"
  value = {
    "api.fabrick.me"     = "CNAME → ${azurerm_linux_function_app.api.default_hostname}"
    "console.fabrick.me" = "CNAME → ${azurerm_static_web_app.console.default_host_name}"
  }
}
