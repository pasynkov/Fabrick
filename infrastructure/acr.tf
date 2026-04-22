resource "azurerm_container_registry" "main" {
  name                = "fabrickacr${random_id.suffix.hex}"
  resource_group_name = local.rg
  location            = local.location
  sku                 = "Basic"
  admin_enabled       = false

  tags = local.tags
}
