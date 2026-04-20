## 1. Terraform Setup

- [x] 1.1 Create `applications/landing/infrastructure/` directory
- [x] 1.2 Write `variables.tf` — location (default: westeurope), domain_name (default: fabrick.me)
- [x] 1.3 Write `main.tf` — azurerm provider, resource_group, static_web_app, custom_domain resources
- [x] 1.4 Write `outputs.tf` — hostname, deployment_token (sensitive), validation_token
- [x] 1.5 Run `terraform init` in `infrastructure/`

## 2. Phase 1 Deploy (SWA only)

- [ ] 2.1 Run `terraform apply -target=azurerm_resource_group.landing -target=azurerm_static_web_app.landing`
- [ ] 2.2 Capture outputs: `terraform output hostname` and `terraform output validation_token`

## 3. DNS (GoDaddy)

- [x] 3.1 Add TXT record: `@` → `<validation_token>` (TTL 600)
- [x] 3.2 Add ALIAS record: `@` → `<hostname>` (TTL 600) — via Cloudflare CNAME flattening
- [x] 3.3 Wait for DNS propagation (~10 min), verify with `dig fabrick.me TXT`

## 4. Phase 2 Deploy (Custom Domain)

- [x] 4.1 Run `terraform apply` (creates custom_domain resource, validates against DNS)
- [x] 4.2 Confirm `fabrick.me` shows as custom domain in Azure portal

## 5. Content Deploy

- [x] 5.1 `cd applications/landing && npm run build`
- [x] 5.2 `npx @azure/static-web-apps-cli deploy ./dist --deployment-token $(terraform -chdir=infrastructure output -raw deployment_token)`
- [x] 5.3 Verify `https://fabrick.me` loads the landing page with correct headline
