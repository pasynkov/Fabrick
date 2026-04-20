## Context

The landing page (`applications/landing/`) is a Vite + React static site. Build output is `dist/`. No infrastructure exists yet. The developer has `az login` done, a GoDaddy-registered apex domain `fabrick.me`, and an Azure subscription.

## Goals / Non-Goals

**Goals:**
- Terraform provisions Azure Static Web App (free tier) + custom domain for `fabrick.me`
- Manual deploy via `swa` CLI: `npm run build` → upload `dist/` with deployment token
- GoDaddy DNS: ALIAS + TXT records for apex domain validation

**Non-Goals:**
- CI/CD (GitHub Actions) — future change
- `www.fabrick.me` redirect
- Azure DNS zone (DNS stays in GoDaddy)
- Staging environments

## Decisions

### Azure Static Web Apps, Free tier
Purpose-built for static sites. Includes global CDN, HTTPS, custom domain support at no cost. Alternative (Storage + CDN) requires more Terraform resources and manual HTTPS setup — no benefit for a landing page.

### Two-phase `terraform apply` for apex domain
`azurerm_static_web_app_custom_domain` with `validation_type = "dns-txt-token"` requires a TXT record to exist in DNS before Azure validates the domain. Terraform can't know the validation token before creating the resource — chicken-and-egg. Solution: first apply creates SWA only (using `-target`), outputs the validation token, DNS records get added, second apply creates the custom domain resource.

### Terraform state: local
No remote backend for now — PoC. `terraform.tfstate` lives locally. Future change can add Azure Blob backend if needed.

### Deploy: `swa` CLI with deployment token
`@azure/static-web-apps-cli` (`swa deploy`) is the simplest path for manual deploys. Token comes from `terraform output -raw deployment_token`. No GitHub dependency.

## Risks / Trade-offs

- [DNS propagation] TXT/ALIAS records in GoDaddy can take 5–30 min to propagate → Wait before second `terraform apply`
- [Local tfstate] State file not backed up → Acceptable for PoC; back up manually or add remote backend later
- [Free tier limits] SWA Free has 100 GB/month bandwidth, 500 MB storage → Fine for landing page
- [apex ALIAS in GoDaddy] GoDaddy supports ALIAS (ANAME) records for apex — confirm in GoDaddy UI under "ALIAS" type

## Migration Plan

```
1. terraform apply -target=azurerm_static_web_app.landing
   → outputs: hostname, deployment_token, validation_token

2. GoDaddy DNS:
   TXT  @  <validation_token>   (TTL 600)
   ALIAS @  <hostname>           (TTL 600)

3. Wait ~10 min for DNS propagation

4. terraform apply   (creates custom domain resource)

5. npm run build && swa deploy ./dist --deployment-token <token>

6. Verify: https://fabrick.me loads landing page
```

Rollback: delete custom domain resource in Azure portal or `terraform destroy -target`.
