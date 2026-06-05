# Language + framework detection

Use root files in this order. First match wins for language; framework is inferred from manifests + imports.

## Language

| Root file present                                | Language   |
|--------------------------------------------------|------------|
| `package.json` + any `*.ts` / `tsconfig.json`    | TypeScript |
| `package.json` only                              | JavaScript |
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python   |
| `go.mod`                                         | Go         |
| `Cargo.toml`                                     | Rust       |
| `pom.xml` / `build.gradle*`                      | Java       |
| `composer.json`                                  | PHP        |
| `Gemfile`                                        | Ruby       |
| `kustomization.yaml` at repo root                | YAML       |
| Mostly `*.yaml` / `*.yml` with no manifests      | YAML       |

If multiple manifests appear (e.g. polyglot repo), pick the language with the most source files; record secondaries in `frameworks[]`.

## Framework

### TypeScript / JavaScript

| Signal                                              | Framework   |
|-----------------------------------------------------|-------------|
| `nest-cli.json` OR imports `@nestjs/core`           | NestJS      |
| imports `express` as primary HTTP entry             | Express     |
| imports `fastify`                                   | Fastify     |
| imports `next` and `pages/` or `app/` dir           | Next.js     |
| imports `@hono/`                                    | Hono        |

### Python

| Signal                                              | Framework   |
|-----------------------------------------------------|-------------|
| imports `fastapi`                                   | FastAPI     |
| imports `flask`                                     | Flask       |
| `manage.py` OR imports `django`                     | Django      |
| imports `celery` as primary entry                   | Celery      |

### Java

| Signal                                              | Framework   |
|-----------------------------------------------------|-------------|
| `spring-boot-*` in pom.xml / build.gradle           | Spring Boot |
| `quarkus-*`                                         | Quarkus     |
| `micronaut-*`                                       | Micronaut   |

### Go

| Signal                                              | Framework   |
|-----------------------------------------------------|-------------|
| imports `github.com/gin-gonic/gin`                  | Gin         |
| imports `github.com/go-chi/chi`                     | Chi         |
| imports `github.com/labstack/echo`                  | Echo        |
| imports `github.com/gofiber/fiber`                  | Fiber       |

### YAML

| Signal                                              | Framework   |
|-----------------------------------------------------|-------------|
| `kustomization.yaml` files anywhere                 | Kustomize   |
| `Chart.yaml` files                                  | Helm        |
| `.github/workflows/*.yml` as primary content        | GitHub Actions |

## Project kind

- `monorepo` if `nest-cli.json` with apps[], `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`, `nx.json`, `Cargo.toml` with workspace, multiple `pom.xml` / `build.gradle` in subdirs
- `library` if `package.json` has `"main"` + `"types"` and no app-like entry (`bin`, `start`)
- `service` if exactly one runnable entry (`main.ts`, `app.py`, `main.go`)
- `gitops` if YAML + Kustomize/Helm and no application source
- `infrastructure` if Terraform / Pulumi / CDK files

If detection is ambiguous, set `kind: "unknown"` and document the ambiguity in `notes`.
