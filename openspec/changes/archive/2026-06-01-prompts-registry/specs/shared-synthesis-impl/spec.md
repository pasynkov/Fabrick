## MODIFIED Requirements

### Requirement: SynthesisImpl calls Claude for synthesis
`SynthesisImpl.synthesize()` SHALL call Claude with a system prompt loaded at call time via `PromptRepository.getLatest('synthesis', 'claude')` and a user context built from the supplied repo wiki data. It SHALL use the prompt body found in the returned record at `content.files['prompt.md']`. It SHALL return `{ rawResponse, promptRevisionId }` where `promptRevisionId` is the `id` field of the `PromptRecord` returned by that `getLatest` call.

#### Scenario: Successful Claude call
- **WHEN** synthesize is called with context string and API key
- **AND** `PromptRepository.getLatest('synthesis', 'claude')` returns a record with `id: 'r-1'` and `content.files['prompt.md']` populated
- **THEN** it calls Claude claude-sonnet-4-6 with that body as the system prompt
- **AND** returns `{ rawResponse: <claude-text>, promptRevisionId: 'r-1' }`

#### Scenario: Truncated response throws error
- **WHEN** Claude response has stop_reason = max_tokens
- **THEN** synthesize throws an error
- **AND** no `token_usage` row is persisted by the caller for this attempt

#### Scenario: Missing synthesis prompt fails loudly
- **WHEN** `PromptRepository.getLatest('synthesis', 'claude')` rejects with a not-found error
- **THEN** `SynthesisImpl.synthesize()` propagates that error without falling back to any inline constant

## REMOVED Requirements

### Requirement: Synthesis system prompt is a TS constant
**Reason**: The synthesis prompt is now stored in the `prompt_revisions` table and is read via `PromptRepository` at call time so it can be edited by PlatformAdmin without a code deploy and so analytics rows can attribute the exact revision used.
**Migration**: The export `SYNTHESIS_SYSTEM_PROMPT` and the file `applications/backend/shared/src/synthesis/synthesis-prompt.ts` SHALL be deleted. The seed migration of `prompts-registry` inserts the prior prompt body as `(name='synthesis', agent='claude', revision=1)`. Consumers SHALL read it via `PromptRepository.getLatest('synthesis', 'claude')`.

## ADDED Requirements

### Requirement: SynthesisImpl injects PromptRepository via DI
`SynthesisImpl` SHALL receive `PromptRepository` through `@Inject(PROMPT_REPOSITORY)` constructor injection. It SHALL NOT import or depend on any specific implementation (TypeORM, FS, HTTP) of the prompt store.

#### Scenario: SynthesisImpl works with any PromptRepository implementation
- **WHEN** `SynthesisImpl` is instantiated with `DbPromptRepository`
- **THEN** it loads the synthesis system prompt from the database
- **WHEN** `SynthesisImpl` is instantiated with `FilePromptRepository`
- **THEN** it loads the synthesis system prompt from the filesystem
