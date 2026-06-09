## REMOVED Requirements

### Requirement: Skill reads config
**Reason**: The v1 push flow is replaced end-to-end by `fabrick sync` and the v2 event-sourced dossier API. Skills no longer post zips to the backend.
**Migration**: Run `fabrick init` to write `.fabrick/config.json`, then `fabrick sync` (or `fabrick regen` for a clean state) to drive the v2 backend.

### Requirement: Context folder is zipped and uploaded
**Reason**: Replaced by `POST /v2/repos/:repoId/dossier/events` with per-scope event payloads. There is no remaining zip upload path.
**Migration**: Migrate any wrapper that calls `fabrick push` to call `fabrick sync` instead. The new command emits the same on-disk dossier under `.fabrick/dossier/` and posts events directly.

### Requirement: User receives clear feedback
**Reason**: `fabrick push` no longer exists; feedback is now produced by `fabrick sync`, which prints the returned `dossierUpdatedId`, the per-scope plan, and the patch log entry.
**Migration**: Read `fabrick sync` output (and `.fabrick/patches.log.jsonl`) for the equivalent feedback.
