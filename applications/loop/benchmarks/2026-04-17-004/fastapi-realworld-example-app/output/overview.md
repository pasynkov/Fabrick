# Overview

RealWorld Conduit API — a blogging platform backend implementing the [RealWorld](https://realworld-docs.netlify.app/) spec.

**Type:** REST API server (no frontend, no message queues, no outbound HTTP calls).

**Stack:** Python · FastAPI · asyncpg · PostgreSQL · Alembic · Poetry · JWT (HS256).

## What it does

Provides a complete social blogging API: user registration/auth, article CRUD, comments, follow/unfollow social graph, article favoriting, and tag listing. Every write operation that modifies another user's resources enforces ownership checks via FastAPI dependencies.

## Key resources managed

- **Users** — registration, login, profile update; passwords hashed with per-user salt via bcrypt (`app/services/security.py`)
- **Articles** — create/update/delete by authenticated author; slug auto-generated from title; filterable by tag, author, or favoriting user
- **Comments** — threaded on articles; author-only delete
- **Profiles** — public view of any user; follow/unfollow relationships
- **Tags** — global list of tags across all articles; many-to-many via `articles_to_tags` table
- **Favorites** — user ↔ article many-to-many

## Authentication

JWT tokens issued at login/register, HS256-signed with `SECRET_KEY`, expiry 7 days (`app/services/jwt.py:12`). Clients send `Authorization: Token <jwt>`. Optional auth routes accept unauthenticated requests.

## External integrations

- **PostgreSQL** — sole data store; accessed via asyncpg connection pool managed at app startup/shutdown (`app/db/events.py`)
- **Alembic** — database migrations (`app/db/migrations/`)

No outbound HTTP calls, no message brokers, no caching layer.
