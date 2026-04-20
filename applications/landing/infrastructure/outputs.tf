output "hostname" {
  description = "Default hostname of the Azure Static Web App"
  value       = azurerm_static_web_app.landing.default_host_name
}

output "deployment_token" {
  description = "Deployment token for swa CLI"
  value       = azurerm_static_web_app.landing.api_key
  sensitive   = true
}

output "validation_token" {
  description = "TXT record value for domain validation"
  value       = try(azurerm_static_web_app_custom_domain.apex.validation_token, null)
  sensitive   = true
}
