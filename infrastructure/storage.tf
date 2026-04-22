resource "azurerm_storage_account" "main" {
  name                     = "fabrickstore${random_id.suffix.hex}"
  resource_group_name      = local.rg
  location                 = local.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  # No network restrictions: Functions control plane needs storage access during provisioning.
  # Security: connection string in Key Vault; blob containers are private by default.
  network_rules {
    default_action = "Allow"
    bypass         = ["AzureServices"]
  }

  tags = local.tags
}
