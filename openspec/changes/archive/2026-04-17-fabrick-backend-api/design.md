## Context

Fabrick is a PoC system where repository context (source files) needs to be ingested and stored for downstream use. The infrastructure (`fabrick-infra`) already runs a NestJS skeleton in Docker alongside a MinIO instance. This change adds the first real application layer: a backend API that accepts ZIP uploads, extracts them in-memory, and writes file objects to MinIO.

The backend lives at `applications/backend/api/` and is wired into the existing Docker Compose network.

## Goals / Non-Goals

**Goals:**
- `POST /context/:repo` — accept a multipart ZIP, stream-extract in-memory, write each file to MinIO under `{repo}/context/<filepath>`
- `GET /context/:repo` — list all MinIO objects under `{repo}/context/` (debug)
- Auto-create the `fabrick` bucket at startup if absent
- Minimal viable NestJS module structure (controller, service)

**Non-Goals:**
- Authentication or authorization
- Request validation beyond basic multipart parsing
- Disk-based temp file handling
- Versioning or deduplication of uploaded files
- Production-grade error handling or observability

## Decisions

### 1. Multipart parsing: `@nestjs/platform-express` + `multer` (memory storage)

Rationale: NestJS ships `@nestjs/platform-express` with `multer` integration. Using `memoryStorage()` keeps the ZIP bytes in-memory as `Buffer` without touching disk. This is appropriate for a PoC with small-to-moderate archives.

Alternatives considered:
- `@nestjs/platform-fastify` + `@fastify/multipart`: requires more wiring; `platform-express` is the NestJS default and simpler for this scope.
- Streaming directly from the HTTP request without multer: more complex, no benefit at PoC scale.

### 2. ZIP extraction: `unzipper` npm package (streaming)

Rationale: `unzipper` exposes a streaming `Parse` API that iterates entries without buffering the entire expanded output. Each entry's content can be read into a Buffer and pushed to MinIO without writing to disk.

Alternatives considered:
- `jszip`: loads the entire ZIP into memory at once; less stream-friendly.
- `adm-zip`: synchronous API; not idiomatic in async NestJS services.

### 3. MinIO client: `minio` npm package (official MinIO JS SDK)

Rationale: The `minio` package is the official client and maps directly to the MinIO API. It supports `putObject` with a `Buffer` or `Readable` stream, which matches what `unzipper` produces.

Alternatives considered:
- `aws-sdk` (S3-compatible): works but adds unnecessary AWS-SDK overhead; `minio` is leaner for a MinIO-only PoC.
- `@aws-sdk/client-s3` (v3): same concern; overkill for PoC.

### 4. Module structure: single `ContextModule` with `ContextController` + `ContextService` + `MinioService`

Rationale: Three classes keep responsibilities clear without over-engineering. `MinioService` owns bucket init and object operations; `ContextService` owns ZIP extraction logic; `ContextController` owns HTTP interface.

### 5. Bucket initialization: `onModuleInit` lifecycle hook in `MinioService`

Rationale: Checking/creating the bucket once at startup (via `bucketExists` + `makeBucket`) avoids per-request overhead and fails fast if MinIO is unreachable.

## Risks / Trade-offs

- **In-memory ZIP extraction**: For large archives this will exhaust container memory. → Acceptable for PoC; document as known limitation.
- **No error handling for MinIO unavailability**: Service will throw on startup if MinIO is down. → Acceptable for PoC; Docker Compose `depends_on` mitigates ordering.
- **No upload size limit**: Multer defaults allow arbitrarily large files. → Acceptable for PoC; add `limits` option if needed later.
- **Overwrite on re-upload**: Uploading the same repo ZIP twice will silently overwrite objects. → Acceptable; no versioning in scope.
