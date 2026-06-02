import { PromptRecord, PromptRepository } from './prompt-repository.interface';

/**
 * Contract test suite for PromptRepository implementations.
 * Call runPromptRepositoryContractTests(factory) in your implementation's test file.
 */
export function runPromptRepositoryContractTests(
  factory: () => Promise<{
    repo: PromptRepository;
    seed: (records: Omit<PromptRecord, never>[]) => Promise<void>;
    cleanup: () => Promise<void>;
  }>,
) {
  let repo: PromptRepository;
  let seed: (records: PromptRecord[]) => Promise<void>;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const ctx = await factory();
    repo = ctx.repo;
    seed = ctx.seed;
    cleanup = ctx.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('returns the latest revision when multiple revisions exist', async () => {
    await seed([
      { id: 'id-1', name: 'search', agent: 'claude', revision: 1, content: { files: { 'prompt.md': 'v1' } } },
      { id: 'id-2', name: 'search', agent: 'claude', revision: 2, content: { files: { 'prompt.md': 'v2' } } },
      { id: 'id-3', name: 'search', agent: 'claude', revision: 3, content: { files: { 'prompt.md': 'v3' } } },
    ]);

    const record = await repo.getLatest('search', 'claude');
    expect(record.revision).toBe(3);
    expect(record.content.files['prompt.md']).toBe('v3');
    expect(record.id).toBe('id-3');
  });

  it('rejects with an error mentioning (name, agent) when no record found', async () => {
    await expect(repo.getLatest('nonexistent', 'claude')).rejects.toThrow(/nonexistent.*claude|claude.*nonexistent/);
  });
}
