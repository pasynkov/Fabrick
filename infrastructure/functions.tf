resource "azurerm_application_insights" "api" {
  name                = "fabrick-api-insights"
  resource_group_name = local.rg
  location            = local.location_web
  application_type    = "web"

  tags = local.tags
}

resource "azurerm_service_plan" "api" {
  name                = "fabrick-api-plan"
  resource_group_name = local.rg
  location            = local.location_web
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption

  tags = local.tags
}

resource "azurerm_linux_function_app" "api" {
  name                        = "fabrick-api-${random_id.suffix.hex}"
  resource_group_name         = local.rg
  location                    = local.location_web
  service_plan_id             = azurerm_service_plan.api.id
  storage_key_vault_secret_id = azurerm_key_vault_secret.storage_connection.versionless_id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "20"
    }
    application_insights_connection_string = azurerm_application_insights.api.connection_string
    # CORS configured post-deploy via az functionapp cors add (provider 4.x bug with cors block)
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"
    WEBSITE_RUN_FROM_PACKAGE = "1"

    # Database — host/port/name/user are not secrets
    DB_HOST = azurerm_postgresql_flexible_server.main.fqdn
    DB_PORT = "5432"
    DB_NAME = "fabrick"
    DB_USER = "fabrick"

    # Queue
    QUEUE_DRIVER = "service-bus"

    # Secrets via Key Vault references
    DB_PASS                         = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=db-password)"
    JWT_SECRET                      = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=jwt-secret)"
    AZURE_STORAGE_CONNECTION_STRING = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=storage-connection)"
    SERVICE_BUS_CONNECTION          = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=servicebus-connection)"
  }

  tags = local.tags

  lifecycle {
    ignore_changes = [
      site_config[0].cors,
    ]
  }

  depends_on = [
    azurerm_key_vault_secret.db_password,
    azurerm_key_vault_secret.jwt_secret,
    azurerm_key_vault_secret.storage_connection,
    azurerm_key_vault_secret.servicebus_connection,
  ]
}

# CORS — configured via CLI due to azurerm provider 4.x bug with cors block in site_config
resource "null_resource" "api_cors" {
  triggers = {
    function_app = azurerm_linux_function_app.api.id
    origins      = "https://console.fabrick.me,https://${azurerm_static_web_app.console.default_host_name}"
  }

  provisioner "local-exec" {
    command = <<-CMD
      az functionapp cors add \
        --name ${azurerm_linux_function_app.api.name} \
        --resource-group ${local.rg} \
        --allowed-origins https://console.fabrick.me https://${azurerm_static_web_app.console.default_host_name}
    CMD
  }
}
