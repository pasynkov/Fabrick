# Overview

`fabrick-api` is a NestJS HTTP API server that acts as a repository context ingestion service. It accepts ZIP archives containing source files and stores them in MinIO object storage, making them available for downstream processing by other Fabrick services.

## Purpose

The API provides a simple interface for uploading and retrieving repository "context" — a snapshot of source files from a codebase. It does not process or analyze the content; it is a storage layer.

## Application Type

RESTful HTTP API server (NestJS on port 3000), containerized with Docker, backed by MinIO S3-compatible object storage.

## Key Resources

- **Context** (`/context/:repo`): A named collection of files associated with a repository. Stored as objects in MinIO under the key prefix `{repo}/context/`.

## External Dependencies

- **MinIO**: S3-compatible object storage used to persist all uploaded files. Connection configured via environment variables (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check — returns `{"status":"ok"}` |
| POST | `/context/:repo` | Upload a ZIP archive for the given repo; extracts and stores all files |
| GET | `/context/:repo` | List all stored file keys for the given repo |

## Module Structure

- `AppModule` → imports `ContextModule`, declares `HealthController`
- `ContextModule` → imports `MinioModule`, declares `ContextController` + `ContextService`
- `MinioModule` → provides and exports `MinioService`
