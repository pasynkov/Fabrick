---
slug: contracts/api-gateway
category: contracts
title: API Gateway
sources:
  - repo-b
related:
  - logic/auth-service
---

# API Gateway

HTTP gateway service (repo-b) that proxies requests to upstream services and validates JWT tokens.

## Behavior

- Proxies all requests to the repo-a auth service
- Validates JWT tokens on all protected routes
- Issues from the auth service's `/auth/login` endpoint are propagated

## Related Pages
- [Auth Service](../logic/auth-service.md) — upstream JWT token issuer
