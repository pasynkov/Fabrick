# Custom domains — apply AFTER DNS records are set up.

# Step 1: run `terraform output dns_records_required` to get CNAMEs
# Step 2: create CNAME records at your DNS provider
# Step 3: uncomment and re-run `terraform apply`

# --- api.fabrick.me ---------------------------------------------------------

resource "azurerm_app_service_custom_hostname_binding" "api" {
  hostname            = "api.fabrick.me"
  app_service_name    = azurerm_function_app_flex_consumption.api.name
  resource_group_name = local.rg
}

# NOTE: azurerm_app_service_managed_certificate is not supported for Flex Consumption plans.
# SSL cert is managed via Cloudflare proxy (api.fabrick.me → CNAME → azurewebsites.net).
# If self-managed cert needed, use: az webapp config ssl bind / az functionapp config ssl

# --- console.fabrick.me ------------------------------------------------------

resource "azurerm_static_web_app_custom_domain" "console" {
  static_web_app_id = azurerm_static_web_app.console.id
  domain_name       = "console.fabrick.me"
  validation_type   = "cname-delegation"
}
