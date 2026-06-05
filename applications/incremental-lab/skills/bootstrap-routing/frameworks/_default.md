# Default framework hint (no specific framework detected)

Use only what the snapshot reveals. Lean entirely on the decoratorMatrix, import frequencies, and topFiles. Apply the global thresholds:

- A decorator/annotation is a slug signal only when count >= 5 AND >= 80% concentration in a slug-mapped file pattern, or when it always co-imports a slug-specific EXTERNAL library.
- Generic helpers (validation, serialization, DI) are excluded.

## Heuristics that work for most languages

### Slug → file patterns

| Pattern                  | Slug(s)                    |
|--------------------------|----------------------------|
| `*controller*` / `*handler*` / `*api*` | contracts |
| `*router*` / `*routes*`  | contracts                  |
| `*service*` / `*usecase*` | service                   |
| `*config*` / `*settings*` | config                    |
| `*entity*` / `*model*` / `*schema*` | integrations    |
| `*repository*` / `*dao*` | integrations               |
| `*migration*`            | integrations               |
| `*main*` / `*app*` / `*bootstrap*` | service          |
| `*test*` / `*spec*` / `__tests__/*` | (skip)         |
| `index.*` / `mod.*`      | (skip — barrel re-export)  |
| `docker-compose*.yml`    | service                    |
| `Dockerfile*`            | service                    |

### Slug → import categories

| Import pattern                                | Slug(s)        |
|-----------------------------------------------|----------------|
| Database drivers (pg, mysql2, sqlite3, mongodb, mongoose, sqlalchemy, gorm, JDBC, etc.) | integrations |
| Message brokers (kafka, rabbitmq, nats, redis pubsub, sqs, pubsub)                       | integrations |
| Cloud SDKs (`@google-cloud/*`, `@aws-sdk/*`, `@azure/*`, `boto3`)                        | integrations |
| HTTP clients (axios, got, requests, http) for OUTGOING calls only                        | integrations |
| Framework runtime (web framework core, microservices, common)                            | service      |
| Routing/handlers (HTTP framework's route module, message-pattern module)                 | contracts    |
| Config / dotenv / settings parsers                                                       | config       |

## Gotchas

- HTTP client libraries (`axios`, `requests`) are integrations only when used to call EXTERNAL services. In-process middleware imports also include them; verify the import is on a file that makes outgoing calls.
- Logging libraries (winston, pino, structlog, log4j) are service plumbing, not integrations.
- ORM libraries are integrations because they imply database connection; the schema definitions ARE integrations.md content.
- Generic JSON / serialization / validation helpers (lodash, zod, pydantic, jackson) are NOT slug signals on their own.
