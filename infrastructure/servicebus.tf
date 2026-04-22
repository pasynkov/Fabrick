resource "azurerm_servicebus_namespace" "main" {
  name                = "fabrick-sb-${random_id.suffix.hex}"
  resource_group_name = local.rg
  location            = local.location
  sku                 = "Standard"

  tags = local.tags
}

resource "azurerm_servicebus_queue" "synthesis_jobs" {
  name         = "synthesis-jobs"
  namespace_id = azurerm_servicebus_namespace.main.id

  lock_duration                = "PT5M"
  max_delivery_count           = 3
  dead_lettering_on_message_expiration = true
}
