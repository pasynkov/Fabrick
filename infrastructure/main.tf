data "azurerm_client_config" "current" {}

data "azurerm_resource_group" "main" {
  name = "fabrick-prod"
}

# Landing lives in a separate RG (already deployed)
data "azurerm_resource_group" "landing" {
  name = "fabrick-landing"
}

data "azurerm_static_web_app" "landing" {
  name                = "fabrick-landing"
  resource_group_name = data.azurerm_resource_group.landing.name
}

locals {
  location     = data.azurerm_resource_group.main.location # polandcentral
  location_web = "westeurope" # Functions + Static Web Apps not available in polandcentral
  rg           = data.azurerm_resource_group.main.name

  tags = {
    project = "fabrick"
    env     = "prod"
  }
}

# Unique suffix for globally-scoped names (storage, kv, acr, functions, servicebus)
resource "random_id" "suffix" {
  byte_length = 3
}

# Generated secrets — never leave Terraform state
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*-_=+?"
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_bytes" "encryption_key" {
  length = 32
}
