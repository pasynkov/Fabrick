## MODIFIED Requirements

### Requirement: Synthesis worker has no database dependency
The synthesis service SHALL NOT connect to PostgreSQL. It SHALL delegate core logic (buildContext, synthesize, parseResponse) to shared `SynthesisImpl`. The processor SHALL load wiki files from Azure Blob storage and pass them as pre-loaded data to `SynthesisImpl.buildContext()`. Page upsert/delete SHALL continue via HTTP callbacks to API. Queue subscription and job orchestration SHALL remain in the processor.

#### Scenario: Processor delegates to SynthesisImpl
- **WHEN** synthesis receives a job from the queue
- **THEN** it loads wiki files from blob storage, calls `SynthesisImpl.buildContext()` with loaded data, calls `SynthesisImpl.synthesize()`, calls `SynthesisImpl.parseResponse()`, then upserts/deletes pages via HTTP callbacks

#### Scenario: System prompt comes from shared constant
- **WHEN** SynthesisImpl calls Claude
- **THEN** it uses `SYNTHESIS_SYSTEM_PROMPT` imported from `@app/shared`, not from a local text file asset

#### Scenario: Synthesis starts without DB env vars
- **WHEN** synthesis service starts with no `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` env vars
- **THEN** service starts successfully and processes jobs normally
