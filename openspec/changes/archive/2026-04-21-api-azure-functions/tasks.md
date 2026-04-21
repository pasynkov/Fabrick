## Prerequisites

- [x] `synthesis-extract` complete (API has no background tasks)

## 1. Install adapter

- [x] 1.1 Add `@nestjs/azure-func-http` and `@azure/functions` to `applications/backend/api/package.json`
- [x] 1.2 Run `npm install` and verify no peer dependency conflicts

## 2. Functions entry point

- [x] 2.1 Create `applications/backend/api/src/main.azure.ts` using `AzureHttpAdapter(AppModule)`
- [x] 2.2 Create `applications/backend/api/host.json`:
  ```json
  { "version": "2.0", "extensionBundle": { "id": "Microsoft.Azure.Functions.ExtensionBundle", "version": "[4.*, 5.0.0)" } }
  ```
- [x] 2.3 Create `applications/backend/api/local.settings.json` (add to `.gitignore`):
  ```json
  { "IsEncrypted": false, "Values": { "FUNCTIONS_WORKER_RUNTIME": "node", "AzureWebJobsStorage": "UseDevelopmentStorage=true" } }
  ```
- [x] 2.4 Update `nest-cli.json` to include `main.azure.ts` as secondary entry (or configure build to output both)

## 3. TypeORM pool size

- [x] 3.1 In `app.module.ts` TypeORM config, set `extra: { max: 2 }` to limit connections per Functions instance

## 4. Verify local modes

- [x] 4.1 Confirm `docker-compose up` still starts Express server on port 3000 (unchanged)
- [x] 4.2 Confirm `func start` in `applications/backend/api/` works locally with `local.settings.json`
- [x] 4.3 Verify all routes reachable via both modes

## 5. Build config

- [x] 5.1 Verify `npm run build` outputs `dist/main.js` (Express) and `dist/main.azure.js` (Functions)
- [x] 5.2 Add `.funcignore` to exclude `node_modules`, `src/`, `test/` from Functions deployment package
