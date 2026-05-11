---
slug: logic/auth-service
category: logic
title: Auth Service
sources:
  - repo-a
related:
  - contracts/api-gateway
---

# Auth Service

JWT-based authentication service (repo-a).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Authenticate user; returns access and refresh tokens |

## Token Format

Returns both **access token** and **refresh token** as JWT.

## Related Pages
- [API Gateway](../contracts/api-gateway.md) — validates JWT tokens from this service on all protected routes
