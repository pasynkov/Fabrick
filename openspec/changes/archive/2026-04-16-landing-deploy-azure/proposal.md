## Why

The landing page exists locally but has no public URL. Deploying to Azure Static Web Apps with a custom apex domain (`fabrick.me`) makes Fabrick publicly accessible for the first time.

## What Changes

- Add `applications/landing/infrastructure/` — Terraform config for Azure Static Web Apps
- Provision: resource group, static web app, custom domain binding for `fabrick.me`
- Deploy static build to Azure using `swa` CLI (manual, no CI/CD yet)
- GoDaddy DNS: add ALIAS + TXT records to point `fabrick.me` at Azure SWA

## Capabilities

### New Capabilities

- `azure-swa-infra`: Terraform config that provisions Azure Static Web Apps for the landing page
- `swa-deploy`: Manual deploy of `dist/` to Azure SWA via `swa` CLI

### Modified Capabilities

<!-- none -->

## Impact

- New directory: `applications/landing/infrastructure/`
- No changes to existing landing page source code
- External dependencies: Azure subscription, GoDaddy DNS, Terraform CLI, `@azure/static-web-apps-cli`
- Domain: `fabrick.me` (registered in GoDaddy, apex, no www redirect in scope)
