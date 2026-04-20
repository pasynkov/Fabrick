terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = "25e02d7e-7a8d-4231-a99e-5f0b3dae4096"
}

resource "azurerm_resource_group" "landing" {
  name     = "fabrick-landing"
  location = var.location
}

resource "azurerm_static_web_app" "landing" {
  name                = "fabrick-landing"
  resource_group_name = azurerm_resource_group.landing.name
  location            = azurerm_resource_group.landing.location
  sku_tier            = "Free"
  sku_size            = "Free"
}

resource "azurerm_static_web_app_custom_domain" "apex" {
  static_web_app_id = azurerm_static_web_app.landing.id
  domain_name       = var.domain_name
  validation_type   = "dns-txt-token"
}
