resource "azurerm_static_web_app" "console" {
  name                = "fabrick-console"
  resource_group_name = local.rg
  location            = local.location_web
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = local.tags
}

# Landing already exists in fabrick-landing RG — managed separately
# To import: terraform import azurerm_static_web_app.landing /subscriptions/.../resourceGroups/fabrick-landing/providers/Microsoft.Web/staticSites/fabrick-landing
