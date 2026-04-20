## Why

CLI `login` command hangs after successful auth (no `process.exit`), stores credentials in `~/.fabrick/` instead of `.fabrick/` in the project, and `init` fails with "fetch failed" when using a localhost API URL — blocking local development workflows entirely.

## What Changes

- `login`: call `process.exit(0)` after credentials are saved to prevent process hang
- `CredentialsService`: store credentials in `.fabrick/credentials.yaml` relative to CWD, not `~/.fabrick/credentials.yaml`
- `CredentialsService`: fall back to global `~/.fabrick/credentials.yaml` when no project-local creds exist (so `login` before `init` still works)
- `ApiService`: handle `fetch failed` for HTTP URLs — ensure Node.js fetch is not blocked by TLS/HTTPS assumptions on localhost
- `login`: default `api_url` written to creds should respect `FABRICK_API_URL` env var (already does, but surface this in success message)

## Capabilities

### New Capabilities
- `cli-auth-flow`: Login, credential storage, and API connectivity for the Fabrick CLI

### Modified Capabilities
<!-- no existing specs track CLI behavior -->

## Impact

- `applications/cli/src/login.command.ts`: add `process.exit(0)`, fix success message
- `applications/cli/src/credentials.service.ts`: project-local path with global fallback
- `applications/cli/src/init.command.ts`: no changes needed if credential path fix is sufficient
- No API changes, no breaking changes to `.fabrick/config.yaml` format
