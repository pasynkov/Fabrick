---
slug: entities/database
category: entities
title: Database
sources:
  - repo-a
related:
  - logic/auth-service
  - overview
---

# Database

The PostgreSQL database is owned and managed by repo-a. It backs the Auth Service.

## Overview

| Property | Value |
|---|---|
| Engine | PostgreSQL |
| Owner | repo-a |
| Primary consumer | Auth Service |

## Schema

> Detailed schema definitions are sourced from repo-a. Expand this page as schema documentation becomes available in the repository wiki.

Known tables/concerns:
- **Users** — Stores credentials and identity information used by the Auth Service during login.

## Related Pages
- [Auth Service](../logic/auth-service) — Primary service reading from and writing to this database
- [System Overview](../overview) — Architecture context for the database's role
