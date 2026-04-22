resource "azuread_application" "github_deploy" {
  display_name = "fabrick-github-deploy"
}

resource "azuread_service_principal" "github_deploy" {
  client_id = azuread_application.github_deploy.client_id
}

resource "azuread_service_principal_password" "github_deploy" {
  service_principal_id = azuread_service_principal.github_deploy.id
}

# Contributor on the resource group — needed for az containerapp update
resource "azurerm_role_assignment" "github_deploy_contributor" {
  scope                = data.azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.github_deploy.object_id
}

# AcrPush on the container registry — needed for docker push
resource "azurerm_role_assignment" "github_deploy_acr_push" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPush"
  principal_id         = azuread_service_principal.github_deploy.object_id
}
