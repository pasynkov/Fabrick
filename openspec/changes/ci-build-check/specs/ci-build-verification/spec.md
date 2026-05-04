## ADDED Requirements

### Requirement: Build verification step in ci-implementation pipeline
`ci-implementation.yml` SHALL run `npm run build` for all three applications after the `review-fix` commit step and before the `archive` step. The applications to build are: `applications/backend/api`, `applications/console`, `applications/landing`. The console build SHALL receive `VITE_API_URL=https://placeholder` as an environment variable. If all builds succeed, the pipeline continues to archive with no additional commits.

#### Scenario: All builds pass
- **WHEN** `ci-implementation.yml` runs the build verification step
- **AND** `npm run build` succeeds for api, console, and landing
- **THEN** no additional commits are created
- **AND** the pipeline proceeds to the archive step

#### Scenario: Build fails for one or more applications
- **WHEN** `npm run build` fails for any application during build verification
- **THEN** the build errors are captured
- **AND** the AI build-fix step runs to repair compilation errors
- **AND** after fixes are applied, builds are re-run to confirm they pass
- **AND** a commit `fix: build errors for <change-name>` is pushed before archive

### Requirement: AI-driven build fix step
`ci-implementation.yml` SHALL include a `claude-code-base-action` step immediately after the build check step. This step SHALL only run if the build check step fails. It SHALL instruct Claude to fix TypeScript compilation errors in implementation files without modifying test files or workflow files.

#### Scenario: AI fix step runs on build failure
- **WHEN** the build verification step fails
- **THEN** `claude-code-base-action` runs with allowed tools: Bash, Read, Write, Edit, Glob
- **AND** Claude fixes compilation errors in application source files
- **AND** Claude does NOT modify files under `.github/workflows/` or test files (`*.spec.ts`, `*.test.ts`, `*.e2e.ts`)
- **AND** after fixes, builds are re-run to verify they pass

#### Scenario: AI fix step is skipped on build success
- **WHEN** the build verification step succeeds
- **THEN** the AI fix step is skipped entirely
- **AND** no unnecessary agent invocation occurs
