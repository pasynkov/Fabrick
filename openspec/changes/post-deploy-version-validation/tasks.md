## 1. API Health Endpoint Enhancement

- [ ] 1.1 Modify health controller to read version from package.json dynamically
- [ ] 1.2 Update health endpoint response to include 'app-version' field
- [ ] 1.3 Test health endpoint returns correct version locally
- [ ] 1.4 Verify health endpoint works in Azure Functions deployment

## 2. Frontend Version File Generation

- [ ] 2.1 Add build script/plugin to generate health.json during Vite build for Console app
- [ ] 2.2 Add build script/plugin to generate health.json during Vite build for Landing app
- [ ] 2.3 Configure Vite to include health.json in static assets output
- [ ] 2.4 Verify health.json is accessible at / path when served locally
- [ ] 2.5 Test health.json generation in both frontend builds

## 3. CI/CD Validation Implementation

- [ ] 3.1 Create version validation script/job for cd-release.yml pipeline
- [ ] 3.2 Implement version extraction from release branch/tag in validation step
- [ ] 3.3 Add API version check (curl /health endpoint, parse json, compare version)
- [ ] 3.4 Add Console frontend version check (curl /health.json, parse json, compare version)
- [ ] 3.5 Add Landing frontend version check (curl /health.json, parse json, compare version)
- [ ] 3.6 Implement retry logic (3 attempts with backoff) for version checks
- [ ] 3.7 Add clear error messages for version mismatches: '<app-name> version mismatch'
- [ ] 3.8 Configure validation job to run after all deployment jobs complete
- [ ] 3.9 Make validation job failure stop pipeline with error status

## 4. Testing & Verification

- [ ] 4.1 Test version validation in staging/release pipeline
- [ ] 4.2 Verify API health endpoint includes version after deployment
- [ ] 4.3 Verify frontend health.json files are served after deployment
- [ ] 4.4 Test validation detects version mismatch and fails pipeline
- [ ] 4.5 Test retry logic handles transient network failures
- [ ] 4.6 Verify clear error messages appear in pipeline logs
