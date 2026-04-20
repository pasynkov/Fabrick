## 1. Fix process hang after login

- [x] 1.1 Add `process.exit(0)` at end of `LoginCommand.run()` in `login.command.ts`
- [x] 1.2 Update success log message to show `.fabrick/credentials.yaml` instead of `~/.fabrick/credentials.yaml`

## 2. Project-local credentials storage

- [x] 2.1 Change `CredentialsService.path` from `join(homedir(), '.fabrick', 'credentials.yaml')` to `join(process.cwd(), '.fabrick', 'credentials.yaml')`
- [x] 2.2 Add global fallback path `join(homedir(), '.fabrick', 'credentials.yaml')` in `CredentialsService`
- [x] 2.3 Update `read()` to check local path first, fall back to global path
- [x] 2.4 Keep `write()` writing to local path only

## 3. Fix fetch failed on localhost

- [x] 3.1 In `ApiService.request()`, trim whitespace from `apiUrl` before concatenating with `path`
- [x] 3.2 Verify no trailing slash issues: normalize URL construction to avoid double-slash (e.g., `apiUrl.replace(/\/$/, '') + path`)
