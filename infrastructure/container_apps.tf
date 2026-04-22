resource "azurerm_log_analytics_workspace" "main" {
  name                = "fabrick-logs"
  resource_group_name = local.rg
  location            = local.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = local.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "fabrick-cae"
  resource_group_name        = local.rg
  location                   = local.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = local.tags
}

resource "azurerm_container_app" "synthesis" {
  name                         = "fabrick-synthesis"
  resource_group_name          = local.rg
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = "system"
  }

  # Synthesis is a pure queue worker — no ingress needed
  # Not reachable from internet

  secret {
    name  = "servicebus-connection"
    value = azurerm_servicebus_namespace.main.default_primary_connection_string
  }
  secret {
    name  = "storage-connection"
    value = azurerm_storage_account.main.primary_connection_string
  }
  secret {
    name  = "anthropic-api-key"
    value = var.anthropic_api_key
  }

  template {
    min_replicas = 0
    max_replicas = 5

    container {
      name  = "synthesis"
      image = "${azurerm_container_registry.main.login_server}/synthesis:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "QUEUE_DRIVER"
        value = "service-bus"
      }
      env {
        name        = "SERVICE_BUS_CONNECTION"
        secret_name = "servicebus-connection"
      }
      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection"
      }
      env {
        name        = "ANTHROPIC_API_KEY"
        secret_name = "anthropic-api-key"
      }
      env {
        name  = "API_BASE_URL"
        value = "https://${azurerm_linux_function_app.api.default_hostname}"
      }
    }

    custom_scale_rule {
      name             = "service-bus-trigger"
      custom_rule_type = "azure-servicebus"
      metadata = {
        queueName    = "synthesis-jobs"
        messageCount = "1"
      }
      authentication {
        secret_name       = "servicebus-connection"
        trigger_parameter = "connection"
      }
    }
  }

  tags = local.tags
}

# AcrPull: synthesis managed identity → ACR
resource "azurerm_role_assignment" "synthesis_acr_pull" {
  principal_id         = azurerm_container_app.synthesis.identity[0].principal_id
  role_definition_name = "AcrPull"
  scope                = azurerm_container_registry.main.id
}
