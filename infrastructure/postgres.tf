resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "fabrick-postgres"
  resource_group_name    = local.rg
  location               = local.location
  version                = "16"
  administrator_login    = "fabrick"
  administrator_password = random_password.db.result
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  backup_retention_days  = 7
  zone                   = "1"

  tags = local.tags
}

# Allow all Azure services (Consumption plan has dynamic IPs)
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "fabrick"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
