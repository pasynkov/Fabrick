# Domain

## Entities

- **User** (`app/models/domain/users.py`) — `username`, `email`, `bio`, `image`; stored with `salt` + `hashed_password` in `UserInDB`
- **Profile** (`app/models/domain/profiles.py`) — public view: `username`, `bio`, `image`, `following` (boolean relative to requesting user)
- **Article** (`app/models/domain/articles.py`) — `slug`, `title`, `description`, `body`, `tags` (List[str]), `author` (Profile), `favorited` (boolean), `favorites_count`
- **Comment** (`app/models/domain/comments.py`) — `id`, `body`, `author` (Profile), timestamps
- **Tag** — plain string; no dedicated domain model; exposed as `List[str]`

## Database Tables

(`app/db/queries/tables.py`)
- `users` — id, username, email, salt, hashed_password, bio, image, created_at, updated_at
- `articles` — id, slug, title, description, body, author_id (FK users), created_at, updated_at
- `tags` — tag (string)
- `articles_to_tags` — article_id, tag (many-to-many)
- `favorites` — article_id, user_id (many-to-many)
- Follower/following relationship stored in separate table (queried in `app/db/repositories/profiles.py`)

## Business Rules

- JWT expires in 7 days (`app/services/jwt.py:12`: `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7`)
- JWT algorithm: HS256 (`app/services/jwt.py:11`)
- JWT subject claim: `"access"` (`app/services/jwt.py:10`)
- Default article list page size: 20, offset: 0 (`app/models/schemas/articles.py:8-9`)
- Article list `limit` must be >= 1 (`app/models/schemas/articles.py:42`)
- Username and email must be unique at registration (`app/services/authentication.py`)
- Article slugs must be unique; collision returns HTTP 400 (`app/api/routes/articles/articles_resource.py:65`)
- Article update and delete restricted to original author — enforced by `check_article_modification_permissions` dependency (`app/api/dependencies/articles.py`)
- Comment delete restricted to comment author (`app/api/dependencies/comments.py`)
- Password stored as `bcrypt(salt + password)`; salt generated per user (`app/models/domain/users.py:21-23`)

## Key Business Flows

1. **Registration** — validate uniqueness → hash password with new salt → insert user → issue 7-day JWT
2. **Login** — lookup by email → verify `bcrypt(salt+password)` → issue 7-day JWT
3. **Publish Article** — authenticated user submits title/body/tags → slug generated from title → article + tag associations inserted transactionally
4. **Feed** — returns articles by authors the requesting user follows, paginated
5. **Favorite Article** — creates entry in `favorites` table; `favorited` flag and `favorites_count` reflect per-user state in all article responses
