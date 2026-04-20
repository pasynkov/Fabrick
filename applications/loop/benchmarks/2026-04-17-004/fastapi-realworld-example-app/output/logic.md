# Key Technical Flows

## Startup / Shutdown

`app/core/events.py` registers two lifecycle handlers on the FastAPI app:
- **startup** — `connect_to_db` in `app/db/events.py` calls `asyncpg.create_pool(DATABASE_URL, min_size, max_size)` and stores the pool on `app.state.pool`
- **shutdown** — `close_db_connection` calls `app.state.pool.close()`

Settings are resolved at startup via `get_app_settings()` in `app/core/config.py`, which reads `APP_ENV` and returns the matching settings class (`AppSettings`, `DevAppSettings`, `TestAppSettings`).

## Authentication Flow (POST /api/users/login)

1. `login` handler (`app/api/routes/authentication.py:22`) receives `UserInLogin` body
2. `UsersRepository.get_user_by_email` queries PostgreSQL, returns `UserInDB`
3. `user.check_password(password)` verifies `bcrypt(salt + password)` against stored hash (`app/models/domain/users.py:19`)
4. On success, `jwt.create_access_token_for_user` encodes `{username}` with 7-day expiry, HS256, `SECRET_KEY` (`app/services/jwt.py:27`)
5. Returns `UserInResponse` wrapping `UserWithToken`

## Registration Flow (POST /api/users)

1. `register` handler checks username and email uniqueness via `check_username_is_taken` / `check_email_is_taken` (`app/services/authentication.py`)
2. `UsersRepository.create_user` generates salt, hashes password, inserts user in a transaction (`app/db/repositories/users.py:29`)
3. JWT issued same as login flow

## Per-Request Auth Dependency

`get_current_user_authorizer(required=True|False)` in `app/api/dependencies/authentication.py` extracts the `Authorization: Token <jwt>` header, calls `jwt.get_username_from_token`, then loads the user from DB. Routes pass `required=False` for optional-auth endpoints (e.g. list articles).

## Article Creation (POST /api/articles)

1. `create_new_article` handler (`app/api/routes/articles/articles_resource.py:59`) requires auth
2. `get_slug_for_article(title)` in `app/services/articles.py` generates URL-safe slug
3. Slug uniqueness checked via `check_article_exists`
4. `ArticlesRepository.create_article` inserts article and tags in a transaction, associating tags via `articles_to_tags` table

## Article List / Feed

- `list_articles` (`/api/articles`) accepts `tag`, `author`, `favorited`, `limit`, `offset` query params; auth optional
- `get_articles_for_user_feed` (`/api/articles/feed`) returns articles from followed users only; auth required
- Both delegate to `ArticlesRepository.filter_articles`

## Database Access Layer

All DB access goes through repository classes in `app/db/repositories/`. Repositories receive an `asyncpg` connection from `get_repository` dependency (`app/api/dependencies/database.py`), which acquires from `app.state.pool`. Raw SQL queries are built with `pypika` and loaded from `app/db/queries/queries.py` (aiosql-style). Transactions wrapped explicitly with `async with connection.transaction()`.

## Error Handling

- `HTTPException` → `http_error_handler` returns `{"errors": {"body": [detail]}}` (`app/api/errors/http_error.py`)
- `RequestValidationError` → `http422_error_handler` normalizes validation messages (`app/api/errors/validation_error.py`)
- `EntityDoesNotExist` (from `app/db/errors.py`) is caught in route handlers and re-raised as HTTP 404/400
