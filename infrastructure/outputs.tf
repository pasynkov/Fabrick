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

output "dns_records_required" {
  description = "DNS records to create before custom domains activate"
  value = {
    "api.fabrick.me"     = "CNAME → ${azurerm_linux_function_app.api.default_hostname}"
    "console.fabrick.me" = "CNAME → ${azurerm_static_web_app.console.default_host_name}"
  }
}
